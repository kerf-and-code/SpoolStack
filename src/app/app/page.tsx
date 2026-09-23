import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Dashboard : SpoolStack',
};

// Every count here goes through the signed-in user's client, so it has
// already passed Row Level Security. A zero means "none of yours".
export default async function DashboardPage() {
  const { supabase, userId } = await requireUser();

  const [runs, machines, materials, projects, settings, parameterDefs] = await Promise.all([
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
  ]);

  const errors = [runs, machines, materials, projects, settings, parameterDefs]
    .map((r) => r.error?.message)
    .filter((m): m is string => Boolean(m));

  const tiles = [
    { label: 'Runs logged', value: runs.count ?? 0, href: null },
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

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm opacity-70">
          Run logging arrives in the next milestone. Set up your machines and materials first so every
          run is costed from day one.
        </p>
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
