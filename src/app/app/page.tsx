import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Dashboard : SpoolStack',
};

// Counts are read through the signed-in user's client, so every number here
// has already passed Row Level Security. A zero means "none of yours", never
// "none at all", which is exactly the M0 proof: the policies are doing the
// filtering, not this page.
async function countOf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
): Promise<{ count: number | null; error: string | null }> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  return { count: count ?? null, error: error ? error.message : null };
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [runs, machines, materials, parameterDefs] = await Promise.all([
    countOf(supabase, 'runs'),
    countOf(supabase, 'machines'),
    countOf(supabase, 'materials'),
    countOf(supabase, 'parameter_defs'),
  ]);

  const tiles = [
    { label: 'Runs logged', value: runs },
    { label: 'Machines', value: machines },
    { label: 'Materials', value: materials },
  ];

  const errors = [runs, machines, materials, parameterDefs]
    .map((r) => r.error)
    .filter((e): e is string => e !== null);

  const schemaMissing = errors.some((e) => /does not exist|schema cache/i.test(e));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm opacity-70">
          Phase 1, milestone 0. Machines, materials and run logging come next.
        </p>
      </div>

      {schemaMissing ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">The database schema has not been applied yet.</p>
          <p className="mt-1 opacity-80">
            Run <code className="font-mono">db/schema.sql</code> in the Supabase SQL
            editor, then reload this page.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-lg border border-black/10 p-4 dark:border-white/15"
          >
            <div className="text-sm opacity-60">{tile.label}</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums">
              {tile.value.error ? '--' : (tile.value.count ?? 0)}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-black/10 p-4 text-sm dark:border-white/15">
        <div className="font-medium">Connection check</div>
        <dl className="mt-2 space-y-1 opacity-80">
          <div className="flex gap-2">
            <dt className="w-56 shrink-0">FDM parameter definitions</dt>
            <dd className="font-mono">
              {parameterDefs.error ? parameterDefs.error : (parameterDefs.count ?? 0)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 opacity-60">
          Expect 25 once the schema is applied. Anything else means the seed did not
          land or the reference-table read policy is missing.
        </p>
      </div>

      {errors.length > 0 && !schemaMissing ? (
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
