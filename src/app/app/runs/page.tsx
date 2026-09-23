import type { Metadata } from 'next';
import Link from 'next/link';
import { LocalTime } from '@/components/local-time';
import { Notice, PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/auth';
import { formatDuration } from '@/lib/duration';
import { formatNumber } from '@/lib/format';
import { OutcomeBadge } from './outcome-badge';
import { RunFilters, type FilterValues } from './run-filters';
import { OUTCOMES } from './types';

export const metadata: Metadata = { title: 'Runs : SpoolStack' };

const PAGE_SIZE = 50;
const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const NOTICES: Record<string, string> = {
  saved: 'Run saved.',
  deleted: 'Run deleted.',
};

type Params = Partial<Record<keyof FilterValues | 'tz' | 'page' | 'notice', string>>;

/** A local calendar date to the UTC instant of its midnight, given the browser's offset in minutes. */
function localMidnightUtc(date: string, tzOffsetMin: number, addDays = 0): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + addDays) + tzOffsetMin * 60_000).toISOString();
}

export default async function RunsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase } = await requireUser();
  const sp = await searchParams;

  // Only well-formed values become filters; anything else is ignored rather than erroring.
  const f: FilterValues = {
    outcome: (OUTCOMES as readonly string[]).includes(sp.outcome ?? '') ? sp.outcome! : '',
    machine: UUID.test(sp.machine ?? '') ? sp.machine! : '',
    material: UUID.test(sp.material ?? '') ? sp.material! : '',
    project: UUID.test(sp.project ?? '') ? sp.project! : '',
    from: DATE.test(sp.from ?? '') ? sp.from! : '',
    to: DATE.test(sp.to ?? '') ? sp.to! : '',
  };
  const tzRaw = Number(sp.tz);
  const tz = Number.isFinite(tzRaw) && Math.abs(tzRaw) <= 14 * 60 ? tzRaw : 0;
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const active = Object.values(f).some(Boolean);

  let query = supabase
    .from('runs')
    .select(
      'id, title, completed_at, created_at, outcome, source, duration_minutes, material_qty_used, material_qty_estimated, units_produced, units_good, machines(name), materials(name, unit)',
      { count: 'exact' },
    );
  if (f.outcome) query = query.eq('outcome', f.outcome);
  if (f.machine) query = query.eq('machine_id', f.machine);
  if (f.material) query = query.eq('material_id', f.material);
  if (f.project) query = query.eq('project_id', f.project);
  if (f.from) query = query.gte('completed_at', localMidnightUtc(f.from, tz));
  if (f.to) query = query.lt('completed_at', localMidnightUtc(f.to, tz, 1));

  const [{ data: runs, count, error }, machines, materials, projects] = await Promise.all([
    query
      .order('completed_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from('machines').select('id, name').order('name'),
    supabase.from('materials').select('id, name').order('name'),
    supabase.from('projects').select('id, name').order('name'),
  ]);

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) q.set(k, v);
    if (f.from || f.to) q.set('tz', String(tz));
    if (p > 1) q.set('page', String(p));
    const s = q.toString();
    return s ? `/app/runs?${s}` : '/app/runs';
  };

  const notice = sp.notice ? NOTICES[sp.notice] : undefined;

  return (
    <div>
      <PageHeader
        title="Runs"
        description="Every print, newest first. Tap one for its settings and defects."
        action={{ href: '/app/runs/new', label: 'Log a run' }}
      />
      {notice ? <Notice tone="ok">{notice}</Notice> : null}
      {error ? <Notice tone="error">Could not load runs: {error.message}</Notice> : null}

      <RunFilters
        key={JSON.stringify(f)}
        options={{ machines: machines.data ?? [], materials: materials.data ?? [], projects: projects.data ?? [] }}
        values={f}
        active={active}
      />

      {!error ? (
        <p className="mb-3 text-sm opacity-60">
          {total === 0 ? 'No runs' : total === 1 ? '1 run' : `${formatNumber(total, 0)} runs`}
          {active ? ' match these filters' : ''}
          {pages > 1 ? `, page ${page} of ${pages}` : ''}
        </p>
      ) : null}

      {runs && runs.length === 0 && !active ? (
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
            const title = r.title || r.materials?.name || 'Untitled run';
            const facts = [
              r.machines?.name,
              r.duration_minutes !== null ? formatDuration(r.duration_minutes) : null,
              r.material_qty_used !== null
                ? `${r.material_qty_estimated ? '~' : ''}${formatNumber(r.material_qty_used, 1)} ${r.materials?.unit ?? 'g'}`
                : null,
              r.units_produced > 1 ? `${r.units_good ?? r.units_produced}/${r.units_produced} parts` : null,
              r.source === 'gcode_import' ? 'imported' : null,
            ].filter(Boolean);
            return (
              <li key={r.id}>
                <Link
                  href={`/app/runs/${r.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{title}</div>
                    <div className="text-sm opacity-60">{facts.join(' / ')}</div>
                  </div>
                  <div className="text-sm tabular-nums opacity-60">
                    <LocalTime iso={r.completed_at ?? r.created_at} />
                  </div>
                  <OutcomeBadge outcome={r.outcome} />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      {pages > 1 ? (
        <nav className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="underline underline-offset-2">
              &larr; Newer
            </Link>
          ) : (
            <span />
          )}
          {page < pages ? (
            <Link href={pageHref(page + 1)} className="underline underline-offset-2">
              Older &rarr;
            </Link>
          ) : null}
        </nav>
      ) : null}

      {runs && runs.length > 0 ? (
        <p className="mt-3 text-xs opacity-50">A ~ before a weight means it came from the slicer rather than a scale.</p>
      ) : null}
    </div>
  );
}
