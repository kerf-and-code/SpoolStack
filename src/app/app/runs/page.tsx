import type { Metadata } from 'next';
import Link from 'next/link';
import { LocalTime } from '@/components/local-time';
import { Notice, PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/auth';
import { formatDuration } from '@/lib/duration';
import { formatNumber } from '@/lib/format';

export const metadata: Metadata = { title: 'Runs : SpoolStack' };

// Minimal on purpose: enough to see that a run saved and what it recorded.
// Filters, run detail and editing are milestone M4, the journal.

const OUTCOME_BADGE: Record<string, { label: string; cls: string }> = {
  success: { label: 'Success', cls: 'border-emerald-500/40 bg-emerald-500/10' },
  partial: { label: 'Partial', cls: 'border-amber-500/40 bg-amber-500/10' },
  failure: { label: 'Failed', cls: 'border-red-500/40 bg-red-500/10' },
  aborted: { label: 'Aborted', cls: 'border-neutral-500/40 bg-neutral-500/10' },
};

export default async function RunsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { supabase } = await requireUser();
  const { notice } = await searchParams;

  const { data: runs, error } = await supabase
    .from('runs')
    .select(
      'id, title, completed_at, created_at, outcome, duration_minutes, material_qty_used, material_qty_estimated, units_produced, units_good, machines(name), materials(name, unit)',
    )
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div>
      <PageHeader
        title="Runs"
        description="Every print, newest first."
        action={{ href: '/app/runs/new', label: 'Log a run' }}
      />
      {notice === 'saved' ? <Notice tone="ok">Run saved.</Notice> : null}
      {error ? <Notice tone="error">Could not load runs: {error.message}</Notice> : null}

      {runs && runs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/20 p-8 text-center text-sm dark:border-white/25">
          <p className="opacity-70">No runs logged yet.</p>
          <Link href="/app/runs/new" className="mt-3 inline-block font-medium underline underline-offset-2">
            Log your first run
          </Link>
        </div>
      ) : null}

      {runs && runs.length > 0 ? (
        <ul className="divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/15 dark:border-white/15">
          {runs.map((r) => {
            const badge = OUTCOME_BADGE[r.outcome] ?? { label: r.outcome, cls: '' };
            const title = r.title || r.materials?.name || 'Untitled run';
            const facts = [
              r.machines?.name,
              r.duration_minutes !== null ? formatDuration(r.duration_minutes) : null,
              r.material_qty_used !== null
                ? `${r.material_qty_estimated ? '~' : ''}${formatNumber(r.material_qty_used, 1)} ${r.materials?.unit ?? 'g'}`
                : null,
              r.units_produced > 1
                ? `${r.units_good ?? r.units_produced}/${r.units_produced} parts`
                : null,
            ].filter(Boolean);
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{title}</div>
                  <div className="text-sm opacity-60">{facts.join(' / ')}</div>
                </div>
                <div className="text-sm tabular-nums opacity-60">
                  <LocalTime iso={r.completed_at ?? r.created_at} />
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-xs ${badge.cls}`}>{badge.label}</span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {runs && runs.length > 0 ? (
        <p className="mt-3 text-xs opacity-50">
          A ~ before a weight means it came from the slicer rather than a scale.
        </p>
      ) : null}
    </div>
  );
}
