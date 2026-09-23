# SpoolStack : Build Plan

**From spec to shipped Phase 1.**
Kerf and Code LLC. Written 2026-09-20. Supersedes the Phase 0 feasibility doc of 2026-08-01.

---

## 0. Where this starts

Nothing is built. The `maker-run-log-spec.md` document exists, the Phase 0 feasibility doc exists, and that is all. This plan takes it from there to a running app that you use on your own prints.

Four decisions were made before writing this, and everything below assumes them:

| Decision | Choice | Why |
|---|---|---|
| Stack | Next.js (App Router, TypeScript) + Supabase + Vercel | You already know Next from Six Axes and Kiln. Supabase gives RLS, which is what makes `auth.uid()` in the spec's queries work at all. Vercel keeps the Litmus `/api` and Stripe patterns transferable. |
| Delivery | Web first, installable PWA. Play/TWA deferred | The Bubblewrap and Play Billing pain from Litmus is real and documented. None of it belongs on the critical path of an app with zero users. Next.js also gives server-rendered HTML from day one, which is the SEO hole Litmus spent a month digging out of. |
| Domain seed | FDM only | Per the spec. Phase 5 is data, not code. |
| This session | Plan, then start building | Section 6 lists what is already done and tested. |

### What is NOT being reused from Litmus

Worth stating plainly, because "reuse the Litmus pipeline" is ambiguous and the wrong reading costs weeks:

- **Reused:** the delivery recipe. Supabase project layout, RLS posture, the serverless `/api` handler shape, the Stripe checkout and webhook pattern, the freemium entitlement model (one `subscribers`-style table as the single source of truth), and eventually the Bubblewrap TWA workflow with all its known gotchas.
- **Not reused:** a single line of `App.js`. Litmus is 16.5k lines of Create React App with self-rolled pathname routing and CSS in a template literal. SpoolStack starts clean.

---

## 1. The shape of the thing

One sentence: **a run is an event, and every feature is a query over the events.**

```
reference tables            user setup              the spine              readers
------------------          ------------            -----------            -------
domains          ─┐         machines  ─┐                                   journal      (P1/P2)
parameter_defs   ─┼──────►  materials ─┼──────────►  runs  ────────────►   cost view    (P2)
defect_types     ─┘         projects  ─┘             run_defects           oracle       (P3)
                            user_settings                                  diagnostician (P4)
```

Three properties that must stay true, because breaking any one of them turns Phase 5 into a rewrite:

1. **No cost column ever lands on `runs`.** Runs store `material_qty_used`, `duration_minutes`, `active_labor_minutes`, `units_produced`. Dollars are computed at read time by `run_cost_breakdown`. Change your power rate and all 400 historical runs recost themselves correctly.
2. **Every key in `runs.parameters` exists in `parameter_defs`.** Enforced at write time by `validateParameters()` in the parser module, not by hope. A bag nobody polices becomes mush, and Phase 3 cannot model on mush.
3. **The run form is generated from `parameter_defs`, never hand-written.** Build it data-driven on day one, while only FDM exists, or Phase 5 is a UI rewrite instead of twelve INSERT statements.

### Three additions to the spec's data model

These are deliberate and worth flagging, because two of them cannot be backfilled later.

- **`runs.units_produced` and `units_good`.** The spec's Phase 2 promises a marginal-cost curve as batch size grows. Batch size is not recoverable from a run you logged six months ago. It defaults to 1 so it never slows down a log entry, but the column has to exist from run number one. `units_good` separates "eight parts, one warped" from "the whole plate failed", which is also what makes the failure rate honest rather than binary.
- **`runs.material_qty_estimated`.** True when mass came from a slicer length estimate rather than a scale. An estimated mass on 1.75mm filament with an assumed density carries real error. Phase 2 should be able to say so instead of quietly averaging good and bad measurements together.
- **`defect_types.is_process_related`.** False for filament runout, power loss, a knocked-over part, or a cancel-on-purpose. Phase 2 costing counts those runs (you really did burn the material). Phase 3 calibration must not learn from them, or the oracle concludes that 215C causes power cuts. Separating them is free now and impossible to reconstruct from free-text notes later.

### One thing deliberately deferred, with its exit

**Multi-material runs.** `runs.material_id` is a single FK. An AMS or MMU print with four filaments gets logged under its primary material and is mis-costed by the difference. The fix is a `run_materials(run_id, material_id, qty_used)` child table, which can be added later and backfilled from `runs.material_id` in a single INSERT, with `runs.material_id` kept as the primary material. The gcode parser already sums per-extruder quantities, so total mass is right even today, only the attribution is coarse. This is the right trade for Phase 1: the child table doubles the complexity of the run form for a case most users do not hit.

---

## 2. Phase 1 milestones

Six milestones. Each one ends in something you can check, not something you feel good about. Session estimates assume an evening or a long weekend block, and assume you, not a team.

### M0 : Foundations
**Goal.** A deployed, signed-in, empty app pointed at a real database.

1. Create the Supabase project. Region **West US (Oregon)** for Seattle latency. Save the project ref, URL, publishable key and secret key.
2. Run `db/schema.sql` in the SQL editor. It is idempotent, so a re-run is safe.
3. Verify with the block at the bottom of the file: 1 domain, 25 parameter defs, 20 defect types, RLS on for all 9 tables, `run_cost_breakdown` carrying `{security_invoker=true}`.
4. Scaffold: `npx create-next-app@latest spoolstack --ts --app --tailwind --eslint --src-dir --import-alias "@/*"`.
5. Install `@supabase/supabase-js` and `@supabase/ssr`. **Not** `@supabase/auth-helpers-nextjs`, which is deprecated and handles App Router cookies wrong.
6. Three clients: browser, server component, middleware session refresh. Auth: Google OAuth plus email magic link as fallback.
7. Protected `/app` route group. Unauthenticated redirects to `/sign-in`.
8. Push to `github.com/kerf-and-code/spoolstack`, connect Vercel, set env vars, deploy.

**Exit criteria.** You sign in with Google on the live Vercel URL and land on an empty dashboard. In the SQL editor, `select count(*) from runs` returns 0. From the browser client as a signed-in user, the same query also returns 0 rather than an error, which proves RLS is on and the grants are right.

**Estimate.** 1 to 2 sessions. Most of it is the Supabase auth wiring.

---

### M1 : Setup entities
**Goal.** Define a machine and a filament once, in under two minutes each.

1. Generate DB types: `npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts`. Regenerate after any schema change; this is the thing that catches a column rename at compile time instead of at runtime.
2. Machines CRUD. Required: name, domain. Optional but marked "used for costing": purchase cost, expected life hours, average watts.
3. Materials CRUD. Required: name, domain, unit. Cost entry takes package cost and package quantity and computes `cost_per_unit` in the form; the DB column stays authoritative.
4. Projects CRUD. Two fields. Do not gold-plate this.
5. Settings page: currency, electricity rate, labor rate, and the `include_labor_in_cost` toggle.
6. Server actions with zod validation, not client-side fetch calls.

**Design note that matters.** Every cost field is optional and every one of them is allowed to be blank. `run_cost_breakdown` reports `cost_complete = false` and lists exactly which inputs are missing. A blank power rate must never become a confident $0.00 energy cost. This is the whole "honest statistics" posture expressed in a form layout, and it is also what lets someone log runs on day one and backfill the cost fields before Phase 2.

**Exit criteria.** You have your real printer and two real filaments in the app, entered from your phone, with the cost fields filled from the actual receipts.

**Estimate.** 2 sessions.

---

### M2 : The run form
**Goal.** Log a run manually in under 60 seconds. Timed with a stopwatch, not estimated.

1. Fetch `parameter_defs where domain_id = $1 and is_active order by sort_order`. Render grouped by `group_name`, typed by `data_type`, bounded by `min_value`/`max_value`, labelled with `unit`.
2. Two-tier form. **Quick log** is the six fields that decide everything: project, machine, material, duration, quantity used, outcome. Everything else lives behind a "Settings used" disclosure, collapsed by default.
3. Outcome picker, and when it is not `success`, a defect multi-select from `defect_types` with severity. Process-related defects listed first, external events (runout, power loss, cancelled) in a separate group at the bottom.
4. `units_produced` defaulting to 1, `units_good` only shown when outcome is `partial`.
5. **"Copy from last run"**, prefilling everything except outcome from the most recent run on the same machine and material. This is the single highest-leverage button in Phase 1: most prints are a repeat of the previous one, and it turns a two-minute form into three taps. It is also a Phase 3 teaser in disguise, because "what worked last time" is exactly what the oracle will formalise.
6. Write through `validateParameters()` so nothing illegal reaches the JSONB bag.

**Exit criteria.** Stopwatch: a repeat print logged from the Copy button in under 20 seconds, a fresh manual run in under 60. If it is slower than that, fix the form before moving on. The spec is right that friction here kills everything downstream.

**Estimate.** 3 sessions. This is the most important UI in the product.

---

### M3 : Gcode import
**Goal.** Drop a file, confirm, save.

1. File input accepting `.gcode`, `.gco`, `.g`, `.bgcode`, `.3mf`. **Do not filter by extension alone.** The Litmus import bug is directly applicable: Android's file picker filters on the MIME type the document provider reports, not the extension, and reports `application/octet-stream` for most of these. List every MIME plus a bare `*/*` fallback or gcode files will be greyed out on phones.
2. `const result = parseAndValidate(await file.text(), defs)`. Parsing is client-side; the file never uploads. A 40MB gcode file read as text is fine in a browser but slice the tail if profiling says otherwise: all slicer metadata lives in the first and last few KB.
3. Prefill the form and show a small "from your gcode file" marker on each prefilled field, so the user can see what was inferred and what they typed.
4. Auto-select the material when `filamentType` matches a material's `category`. Leave the picker open otherwise.
5. `materialEstimated = true` renders a subtle "estimated" tag on the grams field with a nudge to weigh it. Mass accuracy is what Phase 2 costing is made of.
6. Set `source = 'gcode_import'`, store `raw` in `source_metadata`. That is your evidence trail when a future slicer version changes its comment format.
7. Surface `validation.rejected` quietly ("2 settings not recognised") and `validation.clamped` loudly, because a clamp means either the file or the dictionary is wrong.

**Exit criteria.** One real file from each of PrusaSlicer, OrcaSlicer, Bambu Studio and Cura, exported from your own machine, imports with duration and mass correct. The unit tests already cover the formats; this checks the tests against reality.

**Estimate.** 1 session. The parser is written and tested (section 6).

---

### M4 : The journal
**Goal.** The log made browsable. This is the proto-Phase-2.

1. Run list as a server component, reverse chronological, cursor-paginated on `(user_id, created_at desc)` which is already indexed.
2. Filters: project, material, machine, outcome, date range. All of them hit existing indexes.
3. Run detail: parameters rendered through `parameter_defs` so keys become labels with units, defects with severity, source badge, photos placeholder.
4. Edit and delete, with a confirm on delete.
5. A minimal dashboard: run count, total print hours, success rate, most-used material. No costs. Those are Phase 2 and showing a half-built cost number is worse than showing none.

**Exit criteria.** 20 runs in the list, every filter returns the right subset, an edit round-trips, and the detail page of a gcode-imported run shows its `source_metadata`.

**Estimate.** 2 sessions.

---

### M5 : Ship it
**Goal.** Good enough that you stop using the spreadsheet.

1. **Mobile first, seriously.** Logging happens standing at the printer with one hand. Design the run form for a phone and let the desktop layout fall out of it, not the reverse.
2. PWA: manifest, icons, installable. A service worker for the app shell.
3. Empty states that teach: the first-run flow should walk machine, then material, then first run.
4. Sentry.
5. A real marketing page at `/`, server-rendered, with the app under `/app`. Next gives you crawlable HTML for free. Do it now and skip the Litmus SEO retrofit entirely.
6. Google Search Console and Bing verification, sitemap, JSON-LD `SoftwareApplication`.

**Exit criteria, and the real definition of Phase 1 done:** you log your own prints for two consecutive weeks without opening a spreadsheet once. If you reach for the spreadsheet, the thing that pulled you back is the next bug to fix.

**Estimate.** 2 sessions.

---

### Phase 1 total

11 to 13 working sessions. At two good sessions a week around a day job and four other products, that is roughly **six to seven weeks**, so a realistic Phase 1 landing is **early to mid November 2026**. The estimate assumes no Play Store work, which is the single biggest reason it is not twice that.

---

## 3. Phases 2 to 5, and what Phase 1 owes them

The point of the spine is that later phases are queries. Here is the check, run against the real schema rather than asserted:

| Phase | What it becomes | New tables needed |
|---|---|---|
| 2 The Ledger | `select * from run_cost_breakdown` plus a failure-rate rollup and a batch-size curve | none |
| 3 The Oracle | `select parameters from runs where material_id=? and machine_id=? and outcome='success' order by created_at desc`, growing into a model over the `is_calibration_relevant` keys | one, for saved calibration profiles |
| 4 The Diagnostician | image in, `run_defects` rows out, `defect_types.likely_causes` as the grounding taxonomy | none for the write path |
| 5 The Expansion | `insert into domains`, `insert into parameter_defs`, `insert into defect_types` | none |

All four proof queries from the spec were run against the built schema and returned correct results (section 6). That is the test of a good spine.

**Phase 2 is where your actual differentiator shows up.** A filament tracker can total up material cost. What it cannot do is amortise the real failure rate into marginal cost with an interval around it, and say honestly that with 11 logged runs the interval is too wide to decide on. That is the same small-sample-inference spine as Verdict, Ledger and Kiln. The shared stats library you planned across those repos should be pulled in here rather than re-derived, and SpoolStack is arguably the best dogfood for it because the cost inputs are physical and checkable.

**Monetization stays off the critical path.** Freemium at around $4/month, free tier is logging plus the journal, paid is the analytics layer. Stripe on web only, wired in Phase 2 when there is something worth paying for. Play Billing 8 and the TWA come after that, using the documented Litmus workflow: edit `app/build.gradle` directly, `gradlew bundleRelease`, `jarsigner`, never `bubblewrap build` on Node 24.

---

## 4. Risk register

Ordered by how much damage each one does, not how likely it is.

| # | Risk | Damage | What buys it down |
|---|---|---|---|
| 1 | **The log never fills.** Every feature reads the log. If logging is tedious, there is no product, only a schema. | Fatal | Gcode import (done, tested). Copy-from-last-run. A stopwatch-measured 60-second target as an M2 exit criterion. Mobile-first. Two-tier form so the optional 19 fields never block the required 6. |
| 2 | **Schema regret.** Discovering at Phase 3 that a column should have existed since run 1. | Severe, unrecoverable | `units_produced`, `material_qty_estimated` and `is_process_related` added now. Deferrals documented with their migration path (section 1). |
| 3 | **`security_invoker` forgotten on a future view.** A view without it runs as owner and bypasses RLS, exposing every user's runs to every user. | Catastrophic, silent | It is set and verified on `run_cost_breakdown`. Add "does every new view have `with (security_invoker = true)`?" to your pre-deploy checklist. Litmus's Supabase audit found zero views in public, so this is a new surface for you. |
| 4 | **Supabase auth in the App Router.** Cookie handling is where most Next plus Supabase projects break. | Days lost | Use `@supabase/ssr` and only that. Never `auth-helpers-nextjs`. Get the middleware refresh right in M0 and never touch it again. |
| 5 | **Scope creep into Phase 3.** Recommendations are the fun part and they are worthless at zero data. | Weeks lost | The spec's explicit out-of-scope list is binding: no cost UI, no recommendations, no photo AI, no live printer APIs, no CNC. |
| 6 | **Slicer format drift.** A slicer release changes a comment key and imports silently degrade. | Slow leak | `source_metadata` keeps the raw matches for re-parsing. The test file is the regression net: add a fixture whenever a new slicer or version appears. |
| 7 | **Parallel-project time.** Six Axes, Litmus, Verdict, Ledger and Kiln all exist. | Schedule | The milestone exit criteria are binary, so a half-finished milestone is visible rather than comfortable. M5's two-week dogfood is the honest gate. |
| 8 | **Nobody wants it.** Filament trackers exist and are free. | Existential, later | Phase 2 is the answer, not Phase 1: the cost and failure-rate modelling is the part a filament-tracker developer does not build. Test it on your own Kerf and Code product decisions first, which is free market research. |

---

## 5. Repository layout

Root: `C:\Users\Test\SpoolStack`, remote `github.com/kerf-and-code/SpoolStack`. Confirmed 2026-09-22.

```
SpoolStack/
  db/
    schema.sql                  <- the whole Phase 1 data model, idempotent
  src/
    app/
      (marketing)/              <- server-rendered public pages, M5
      (app)/                    <- authenticated app
        runs/
        machines/
        materials/
        settings/
      auth/
    components/
    lib/
      gcodeParse.ts             <- client-side slicer metadata extractor
      gcodeParse.test.ts        <- 14 tests, all passing
      supabase/                 <- browser / server / middleware clients
      database.types.ts         <- generated, do not hand-edit
  public/
```

---

## 6. What is already built and verified

Two files are done, tested, and ready to commit.

### `db/schema.sql`

9 tables, 1 view, 16 named indexes, 27 RLS policies, FDM seed data. Verified against PostgreSQL 16.13 with a stand-in `auth` schema mimicking Supabase.

Evidence:

- **Runs clean, and runs twice clean.** Exit code 0 on both passes, no errors. Second pass changed nothing.
- **Seed counts:** 1 domain, 25 parameter defs, 20 defect types.
- **RLS on for all 9 tables.** Confirmed via `pg_class.relrowsecurity`.
- **`run_cost_breakdown` carries `{security_invoker=true}`.** Confirmed via `pg_class.reloptions`.
- **Cost view computes correctly.** Test run: 4h print, 120g at $0.02499/g, 110W machine at $0.115/kWh, $799 printer over 5000h plus $0.02/h maintenance, 20 min labor at $45/h, 8 units.
  - material $3.0000, energy $0.0506, machine $0.7192, labor $15.0000, **total $18.7698, $2.35 per unit**, `cost_complete = true`.
- **Missing inputs are reported, not silently zeroed.** A run with no machine and no material returned `cost_complete = false` and `missing_inputs = {material, material_qty_used, material_cost_per_unit, machine, machine_power_watts, machine_depreciation_inputs}`.
- **RLS isolation holds through the view.** As role `authenticated`: user A sees 3 runs and 3 cost rows, user B sees 1 and 1. `anon` gets `permission denied for table runs`. An insert forging another user's `user_id` is rejected with `new row violates row-level security policy`. An insert into `parameter_defs` as `authenticated` is rejected with `permission denied`.
- **The GIN index is used.** `explain` on `parameters @> '{"nozzle_temp":215}'` chose `Bitmap Index Scan on idx_runs_parameters_gin`, which is what keeps Phase 3 calibration queries fast.
- **All four spec proof queries ran unchanged** and returned correct results: failure rate by material (0.5), last successful settings, defect frequency, and the parameter lookup.

One Supabase-specific gotcha applied from the Litmus work: every function body uses **named** dollar tags (`$set_updated_at$`), because bare `$$` has thrown "unterminated dollar-quoted string" in the Supabase SQL editor.

### `src/lib/gcodeParse.ts`

Rewritten from the spec's draft. Type-checks clean under `tsc --strict`. 14 tests, all passing.

**The bug that forced the rewrite:** the draft matched only PrusaSlicer's `; estimated printing time (normal mode) = 1h 2m 3s`. OrcaSlicer and Bambu Studio write `; total estimated time: 2h 14m 8s`, with a colon. The draft returned `null` for duration on the two most popular slicers of the last two years, which means no print time, which means no energy cost, no machine depreciation and no Phase 2. There is now a test asserting `134.13` minutes on an Orca fixture.

Other fixes and additions over the draft:

- **Multi-extruder sums.** `filament used [g] = 12.55,3.52` now returns 16.07, not 12.55. AMS and MMU prints were under-reporting material by whatever the other slots used. Temperatures still take the first value, because temperatures are not additive.
- **Better mass estimates.** Preference order is stated grams, then volume in cm3 times the material's real density, then length times geometry. The draft went straight to length with an assumed 1.24 density and 1.75mm diameter. A `materialSource` field now says which path was used, so the UI can be specific instead of just saying "estimated".
- **Cura temperatures.** Cura writes almost nothing as settings comments but does write `M104`/`M140`. Those are read as a fallback and flagged in `raw` as coming from a command rather than a settings comment.
- **Orca and Bambu setting names** mapped alongside the Prusa ones: `nozzle_temperature`, `hot_plate_temp`, `retraction_length`, `sparse_infill_density`, `wall_loops`, `outer_wall_speed`, `filament_flow_ratio`, `initial_layer_print_height`.
- **Flow normalised.** Prusa's `extrusion_multiplier = 0.98` and Orca's `filament_flow_ratio = 0.95` become 98 and 95 percent, matching the `parameter_defs` unit.
- **Infill patterns normalised** to the eight enum options, so `crosshatch` becomes `grid` and an unrecognised pattern is dropped rather than violating the enum.
- **Line-anchored setting matching**, so `total filament used [g]` can never be mistaken for `filament used [g]`.
- **Fails soft.** A gcode file with no metadata returns nulls and two warning strings instead of throwing.
- **`validateParameters(parsed, defs)`**, new. Enforces `parameter_defs` before anything reaches the JSONB bag: unknown keys rejected, numbers clamped to range with the original recorded, enums checked against `enum_options`, integers rounded. This is the mechanism that keeps the flexible bag disciplined, and it belongs at every write path, not just import.

---

## 7. Open questions

Two of the five are now answered.

1. ~~**Repo path and name.**~~ Settled 2026-09-22: `C:\Users\Test\SpoolStack`, `github.com/kerf-and-code/SpoolStack`.
2. ~~**Product name.**~~ Settled by the repo name: SpoolStack. Noting the reservation for the record, since it is cheap to change now and expensive at Phase 5: the name is spool-specific, and the spec's whole thesis is that this is not a filament tracker. When CNC and laser arrive the name argues against the product. Revisit before buying a domain, not after.
3. **Domain.** `spoolstack.app`? A subdirectory of `kerfandcode.com`? Litmus taught you that the marketing domain and the app domain are worth separating, but this time you can do it with one Next app and a route group instead of two sites.
4. **Auth providers.** Google OAuth alone, or Google plus email magic link? Magic link costs nothing and covers people without a Google account.
5. **Offline logging.** Printers live in garages and basements with bad wifi. A "save when back online" queue is genuinely useful here and genuinely annoying to retrofit. My recommendation is to keep it out of Phase 1 but make every write go through a single `saveRun()` function so the queue has one place to live later.

---

## 8. Immediate next actions

1. Answer question 1 above.
2. Create the Supabase project, run `db/schema.sql`, run the verification block at the end of it.
3. Scaffold the Next app, commit the two files below into it.
4. Tell me when M0 is deployed and I will build M1.

Files ready now:

| File | Save to |
|---|---|
| `schema.sql` | `C:\Users\Test\spoolstack\db\schema.sql` |
| `gcodeParse.ts` | `C:\Users\Test\spoolstack\src\lib\gcodeParse.ts` |
| `gcodeParse.test.ts` | `C:\Users\Test\spoolstack\src\lib\gcodeParse.test.ts` |
