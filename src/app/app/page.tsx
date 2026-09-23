import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { formatDuration } from '@/lib/duration';

export const metadata: Metadata = {
  title: 'Dashboard : SpoolStack',
};

// Every count here goes through the signed-in user's client, so it has
// already passed Row Level Security. A zero means "none of yours".
export default async function DashboardPage() {
  const { supabase, userId } = await requireUser();

  const [runs, machines, materials, projects, settings, parameterDefs, history] = await Promise.all([
    supabase.from('runs').select('*', { count: 'exact', head: true }),
    supabase.from('machines').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('materials').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase
      .from('user_settings')
      .select('electricity_rate_per_kwh')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.from('parameter_defs').select('*', { count: 'exact', head: true }),
    // Summary inputs. Bounded: past a few thousand runs this moves into a SQL view.
    supabase.from('runs').select('outcome, duration_minutes, material_id, materials(name)').limit(5000),
  ]);

  const errors = [runs, machines, materials, projects, settings, parameterDefs, history]
    .map((r) => r.error?.message)
    .filter((m): m is string => Boolean(m));

  const tiles = [
    { label: 'Runs logged', value: runs.count ?? 0, href: '/app/runs' },
    { label: 'Machines', value: machines.count ?? 0, href: '/app/machines' },
    { label: 'Materials', value: materials.count ?? 0, href: '/app/materials' },
    { label: 'Active projects', value: projects.count ?? 0, href: '/app/projects' },
  ];

  const setup = [
    {
      done: settings.data?.electricity_rate_per_kwh != null,
      label: 'Set your electricity rate',
      detail: 'Without it, energy cost is reported as missing rather than guessed.',
      href: '/app/settings',
    },
    {
      done: (machines.count ?? 0) > 0,
      label: 'Add your printer',
      detail: 'Purchase cost, expected life and wattage drive machine-wear and energy cost.',
      href: '/app/machines/new',
    },
    {
      done: (materials.count ?? 0) > 0,
      label: 'Add a filament',
      detail: 'Package cost and weight give the cost per gram every run is priced with.',
      href: '/app/materials/new',
    },
  ];
  const setupRemaining = setup.filter((s) => !s.done).length;

  // Counts, not percentages: "4 of 5" says how little data there is; "80%" hides it.
  const rows = history.data ?? [];
  const printMinutes = rows.reduce((sum, r) => sum + (r.duration_minutes ?? 0), 0);
  const byOutcome = (o: string) => rows.filter((r) => r.outcome === o).length;
  const materialUse = new Map<string, { name: string; n: number }>();
  for (const r of rows) {
    if (!r.material_id || !r.materials) continue;
    const cur = materialUse.get(r.material_id) ?? { name: r.materials.name, n: 0 };
    cur.n += 1;
    materialUse.set(r.material_id, cur);
  }
  const topMaterial = [...materialUse.values()].sort((a, b) => b.n - a.n)[0];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm opacity-70">
            Log every print, good or bad. The failures are what make the costs honest.
          </p>
        </div>
        <Link
          href="/app/runs/new"
          className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
        >
          Log a run
        </Link>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {tiles.map((tile) => {
          const body = (
            <>
              <div className="text-sm opacity-60">{tile.label}</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">{tile.value}</div>
            </>
          );
          const cls = 'block rounded-lg border border-black/10 p-4 dark:border-white/15';
          return tile.href ? (
            <Link key={tile.label} href={tile.href} className={`${cls} hover:bg-black/5 dark:hover:bg-white/5`}>
              {body}
            </Link>
          ) : (
            <div key={tile.label} className={cls}>
              {body}
            </div>
          );
        })}
      </div>

      {rows.length > 0 ? (
        <section className="rounded-lg border border-black/10 p-5 text-sm dark:border-white/15">
          <h2 className="font-semibold">So far</h2>
          <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide opacity-55">Print time</dt>
              <dd className="mt-0.5 text-lg tabular-nums">{formatDuration(printMinutes) || '0m'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide opacity-55">Outcomes</dt>
              <dd className="mt-0.5">
                <span className="text-lg tabular-nums">{byOutcome('success')}</span> of {rows.length} succeeded
                <span className="block text-xs opacity-60">
                  {[
                    byOutcome('partial') ? `${byOutcome('partial')} partial` : null,
                    byOutcome('failure') ? `${byOutcome('failure')} failed` : null,
                    byOutcome('aborted') ? `${byOutcome('aborted')} aborted` : null,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide opacity-55">Most used</dt>
              <dd className="mt-0.5">
                {topMaterial ? (
                  <>
                    {topMaterial.name} <span className="opacity-60">({topMaterial.n} {topMaterial.n === 1 ? 'run' : 'runs'})</span>
                  </>
                ) : (
                  <span className="opacity-50">no material recorded</span>
                )}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {setupRemaining > 0 ? (
        <section className="rounded-lg border border-black/10 p-5 dark:border-white/15">
          <h2 className="font-semibold">Getting set up</h2>
          <p className="mt-1 text-sm opacity-65">
            {setupRemaining} of {setup.length} left. Every step is optional, but each one you skip shows up
            later as a cost marked incomplete.
          </p>
          <ul className="mt-4 space-y-3">
            {setup.map((step) => (
              <li key={step.label} className="flex items-start gap-3 text-sm">
                <span
                  aria-hidden
                  className={
                    'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ' +
                    (step.done
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-black/25 dark:border-white/30')
                  }
                >
                  {step.done ? '✓' : ''}
                </span>
                <span>
                  {step.done ? (
                    <span className="line-through opacity-60">{step.label}</span>
                  ) : (
                    <Link href={step.href} className="font-medium underline underline-offset-2">
                      {step.label}
                    </Link>
                  )}
                  {!step.done ? <span className="block opacity-60">{step.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs opacity-50">
        Connection check: {parameterDefs.count ?? 0} FDM parameter definitions readable (expect 25).
      </p>

      {errors.length > 0 ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <p className="font-medium">Query errors</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 font-mono text-xs">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
