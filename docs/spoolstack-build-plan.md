# SpoolStack : Build Plan

**From spec to shipped Phase 1.**
Kerf and Code LLC. Written 2026-09-20. Supersedes the Phase 0 feasibility doc of 2026-08-01.

> **Status, 2026-09-23 (night):** M0 to M3 complete on the live app. M4 (journal) and M5 (ship) are built and verified locally, waiting to be committed and exit-tested. Domain `spool-stack.com` is bought; connecting it is a manual checklist (M5 item 8) with no code change left. Current state and the log of what changed are in section 8.

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
8. **Offer to create the machine from the file.** The parser already returns `printerModel` and `filamentBrand`. When no existing machine matches, offer "This file came from a Bambu Lab P1S. Add it as a machine?" and prefill make and model. It's setup from the user's own data with zero catalog to maintain, and it's the cheap first half of the M5 presets item.

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
7. **Setup presets: common printers and filaments to pick from** (requested 2026-09-23). Two read-only reference tables in the same pattern as `parameter_defs`: `machine_models` and `material_presets`. Picking a preset **copies** its values into the user's own row, which stays editable, and keeps a `model_id` link for later analytics. The rule that keeps it honest:
   - **Preload physical specs only:** make, model, nozzle size, build volume, filament diameter, density by polymer. Spec-sheet facts that don't change.
   - **Wattage as a hint, not a value:** shown as placeholder text ("typically ~110 W; a plug meter gives yours"). Real draw varies with bed temperature and enclosure.
   - **Never preload prices.** Machine and filament prices go stale and vary by seller. A preloaded price that's wrong for you produces a confidently wrong cost, which is exactly what "blank means unknown" exists to prevent.
   - Keep it small and curated: about 20 printers and about 15 filament types, from manufacturer spec sheets, not scraped. New printers ship every few months, so the catalog has a maintenance cost; the M3 file-based offer covers the long tail for free.

   **As built (M5):** code constants in `src/lib/presets.ts`, not tables. 18 printers and 11 filament types, each printer with its source noted in the file. A picker on Add machine and Add material sets `?preset=` and pre-fills the form; the saved row is an ordinary row with no link back. Reasons: no SQL to run by hand, the list is reviewed in a pull request like any other change, and nothing needs `model_id` until Phase 3 exists. Move it to tables when users need to add presets themselves. No wattage hint shipped: the form's help text already says to use a plug meter. Nozzle size is left blank where the source did not state it.

8. **Connect `spool-stack.com`** (bought 2026-09-23). Done late on purpose: until real users exist, the vercel.app address costs nothing, and a domain switch resets everyone's sign-in once. In this order:
   1. **Vercel**, Settings, Domains: add `spool-stack.com` and `www.spool-stack.com`, and redirect `www` to the bare domain so there is one canonical address.
   2. **DNS** at the registrar: add exactly the records Vercel shows on that page. Wait for Vercel to show both as valid.
   3. **Supabase**, Authentication, URL Configuration: Site URL becomes `https://spool-stack.com`, and add `https://spool-stack.com/**` to Redirect URLs. Keep the vercel.app and localhost entries so nothing breaks mid-switch.
   4. **Google OAuth** (if set up by then): no change. Google redirects to the Supabase callback, not to the app.
   5. **Test:** sign in on `https://spool-stack.com` with a magic link, and confirm the email link points at spool-stack.com, not vercel.app.
   6. **Code:** nothing to do. `src/lib/site.ts` reads Vercel's `VERCEL_PROJECT_PRODUCTION_URL`, so the canonical URL, sitemap, robots and JSON-LD move to `spool-stack.com` on the first deploy after the domain is set as production in Vercel. Check `/sitemap.xml` after that deploy. `NEXT_PUBLIC_SITE_URL` overrides it if ever needed.
   Auth cookies are per domain, so everyone signs in once more after the switch. No data is affected.

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
      page.tsx, privacy/        <- server-rendered public pages
      manifest.ts, robots.ts, sitemap.ts, icons, OG image
      app/                      <- authenticated app, served at /app
        runs/
        machines/
        materials/
        projects/
        settings/
      auth/                     <- OAuth / magic-link callback, sign-out
      sign-in/
    components/
    lib/
      gcodeParse.ts             <- client-side slicer metadata extractor
      gcodeParse.test.ts        <- parser tests (npm run test:gcode)
      presets.ts                <- machine and filament presets, M5
      supabase/                 <- browser / server / middleware clients
      database.types.ts         <- generated, do not hand-edit
  public/                       <- sw.js, offline.html, icons/
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
2. ~~**Product name.**~~ Settled: SpoolStack. The domain `spool-stack.com` was bought on 2026-09-23, so the earlier reservation (a spool-specific name for a multi-process product) is withdrawn.
3. ~~**Domain.**~~ Settled: `spool-stack.com`. One domain for both the marketing page (`/`) and the app (`/app`), no split like Litmus needed. Connects in M5, item 8.
4. **Auth providers.** Google OAuth alone, or Google plus email magic link? Magic link costs nothing and covers people without a Google account.
5. **Offline logging.** Printers live in garages and basements with bad wifi. A "save when back online" queue is genuinely useful here and genuinely annoying to retrofit. My recommendation is to keep it out of Phase 1 but make every write go through a single `saveRun()` function so the queue has one place to live later.

---

## 8. Status and change log

### Where things stand (2026-09-23)

| Milestone | State | Evidence |
|---|---|---|
| M0 Foundations | **Done** | Live at `spool-stack-six.vercel.app`. Sign-in works. Live DB verified: RLS on all 9 tables, 27 policies, `run_cost_breakdown` has `security_invoker=true`, 25 parameter defs, 20 defect types. |
| M1 Setup entities | **Done** | Machines, materials, projects and settings CRUD live. Exit test passed on real data: inline validation keeps typed values, material costed at $0.015/g through live RLS, duplicate names rejected in plain English, confirm before delete. |
| M2 Run form | **Done** | A real run logged successfully on the live app. Stopwatch times (60 s fresh, 20 s repeat targets) not yet recorded. |
| M3 Gcode import | **Done** | A real Bambu Studio 2.8 `.gcode.3mf` from an A1 imported on the live app: 267 min, 135.88 g, 21 settings. |
| M4 Journal | Built, not yet committed | Run list with filters and paging, run detail, edit and delete, dashboard. 49 tests pass. Exit test (20 runs, filters, edit round-trip) runs after the push. |
| M5 Ship | Built, not yet committed | See the M5 breakdown below. 60 tests pass across four suites; type-check, lint and production build clean. |

**M5 item by item:**

| Item | State |
|---|---|
| 1. Mobile first | Partly. New pages are phone-first; a dedicated one-handed pass on the run form waits for real use at the printer, so it is driven by what is actually awkward. |
| 2. PWA | **Done.** Manifest, icons (any and maskable), apple icon, favicon, theme colours, install shortcuts for Log a run and Runs. Service worker is deliberately minimal: shows `/offline.html` when a page load fails offline and caches nothing else, so no signed-in page can ever be served stale. Verified in Chromium: registers, controls the page, serves the offline page, and gets out of the way when back online. |
| 3. Empty states that teach | Not started. Touches the M4 dashboard, so it follows the M4 commit. |
| 4. Sentry | **Deferred.** Needs an account and a DSN. In its place: an error boundary inside `/app` (keeps the nav, shows a reference digest that matches the Vercel function log), a global error page, and not-found pages for the site and for `/app`. |
| 5. Marketing page | **Done.** Rewritten so every claim is true of the shipped app; costing and later phases are listed under "Coming next", not sold as built. Plus `/privacy`. |
| 6. SEO | **Done in code:** `metadataBase`, Open Graph and Twitter cards with a 1200x630 image, canonical links, `robots.txt` (disallows `/app` and `/auth`), `sitemap.xml`, JSON-LD `SoftwareApplication` with a free offer and no ratings. **Manual, after the domain:** Google Search Console and Bing verification. |
| 7. Presets | **Done,** as code constants. See item 7 above. |
| 8. Domain | Manual checklist in item 8. No code change remains. |

Also in M5: security headers from the Next 16 PWA guide (nosniff, frame DENY, strict referrer; no-cache and a CSP on `sw.js`), the proxy no longer runs on the service worker, manifest, offline page, robots or sitemap, and the import matcher now prefers exact printer matches, so owning both an A1 and an A1 mini still auto-selects the right one.

**Live infrastructure:** Supabase project `fpvmqelajzraqsylmjce` (West US). Vercel project `spool-stack`, production domain `spool-stack-six.vercel.app` until `spool-stack.com` is connected (bought 2026-09-23, M5 item 8). Repo `github.com/kerf-and-code/SpoolStack`, local `C:\Users\Test\SpoolStack`.

### Changes from the original plan, and why

- **Stack is Next 16, not 15.** `create-next-app` installed 16.3.6. Next 16 renamed `middleware.ts` to `proxy.ts`, and it refuses to build with both files present. That's why the auth refresh lives in `src/proxy.ts`.
- **The live database had an unrecognised schema** with the same table names, a 9-row parameter seed, and a cost view **without** `security_invoker`. It was never created from this repo. It was replaced via `db/reset_foreign_schema.sql`, a one-off with a row-count guard that refuses to drop anything if user tables hold data. `db/schema.sql` now has a **preflight** that stops the run if tables exist with a different shape.
- **Adopted from that old schema:** `projects.sale_price` and `projects.target_quantity`, both useful for Phase 2 margin and batch curves.
- **Marketing at `/`, app at `/app`** from M0 rather than M5, so no route retrofit later.
- **Archive by default, delete only when unused**, for machines, materials and projects. The run foreign keys are `ON DELETE SET NULL`, so deleting a used machine would silently strip its cost from every run.
- **Presets are code, not tables** (M5 item 7). See the "As built" note there.
- **Sentry deferred** (M5 item 4) until there is an account and a DSN; error boundaries ship in its place.
- **The service worker does offline-page only.** An app-shell cache for a signed-in, server-rendered app risks showing one session's page to the next; the offline queue in open question 5 is the real answer to bad garage wifi.
- **Site address resolves itself** from `VERCEL_PROJECT_PRODUCTION_URL`, so the domain switch needs no code change.

### Operational lessons, so they are not relearned

- **Windows cmd:** one `-m` per commit-message paragraph. A quoted string spanning lines does not run.
- **Supabase SQL editor:** saved tabs keep old text. Twice, a stale `schema.sql` ran from an old tab. Before running a repo file, Ctrl+F for a marker only the current version has.
- **Always regenerate types after a schema change,** and check the file actually changed (size and a new column name), not just that the command exited.
- **`robocopy` into a git repo must exclude `.git`** (`/XD .git`). Without it the repo's config and HEAD get overwritten.
- **npm package names cannot start with `_`,** which also applies to `create-next-app` folder names.

### Next actions

1. **Commit M4, then M5,** each after its own build. Then the M4 exit test on the live app, and fix the two known bad runs (the 3853-minute mistype and the Copy test duplicate) through the new edit and delete.
2. **Install check on a phone:** open the live site, Add to Home Screen, confirm it opens to `/app` with the new icon.
3. **Connect `spool-stack.com`** (M5 item 8), then Search Console and Bing verification.
4. **Empty states** (M5 item 3), then the two-week dogfood that closes Phase 1. Stopwatch targets from M2 still to record: under 60 seconds fresh, under 20 seconds repeat.
