import type { Metadata } from 'next';
import Link from 'next/link';
import { Notice, PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/auth';
import { formatMoney, formatNumber } from '@/lib/format';
import { getCurrency } from '@/lib/settings';
import { machineCostingGaps } from './fields';

export const metadata: Metadata = { title: 'Machines : SpoolStack' };

const NOTICES: Record<string, { tone: 'ok' | 'warn'; text: string }> = {
  saved: { tone: 'ok', text: 'Machine saved.' },
  archived: { tone: 'ok', text: 'Machine archived. Its runs keep it, and it no longer appears in pickers.' },
  restored: { tone: 'ok', text: 'Machine restored.' },
  deleted: { tone: 'ok', text: 'Machine deleted.' },
};

export default async function MachinesPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; notice?: string }>;
}) {
  const { supabase, userId } = await requireUser();
  const params = await searchParams;
  const showArchived = params.show === 'archived';

  const [{ data: machines, error }, currency] = await Promise.all([
    supabase
      .from('machines')
      .select('id, name, make, model, power_watts, purchase_cost, expected_life_hours')
      .eq('is_active', !showArchived)
      .order('name'),
    getCurrency(supabase, userId),
  ]);

  const notice = params.notice ? NOTICES[params.notice] : undefined;

  return (
    <div>
      <PageHeader
        title="Machines"
        description="The printers you log runs on. Cost fields are optional now and can be backfilled any time."
        action={{ href: '/app/machines/new', label: 'Add machine' }}
      />
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      {error ? <Notice tone="error">Could not load machines: {error.message}</Notice> : null}

      <div className="mb-4 flex gap-4 text-sm">
        <Link href="/app/machines" className={showArchived ? 'opacity-60 hover:opacity-100' : 'font-medium'}>
          Active
        </Link>
        <Link
          href="/app/machines?show=archived"
          className={showArchived ? 'font-medium' : 'opacity-60 hover:opacity-100'}
        >
          Archived
        </Link>
      </div>

      {machines && machines.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/20 p-8 text-center text-sm dark:border-white/25">
          {showArchived ? (
            <p className="opacity-70">No archived machines.</p>
          ) : (
            <>
              <p className="opacity-70">No machines yet.</p>
              <Link href="/app/machines/new" className="mt-3 inline-block font-medium underline underline-offset-2">
                Add your first printer
              </Link>
            </>
          )}
        </div>
      ) : null}

      {machines && machines.length > 0 ? (
        <ul className="divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/15 dark:border-white/15">
          {machines.map((m) => {
            const gaps = machineCostingGaps(m);
            const makeModel = [m.make, m.model].filter(Boolean).join(' ');
            return (
              <li key={m.id}>
                <Link
                  href={`/app/machines/${m.id}`}
                  className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{m.name}</div>
                    {makeModel ? <div className="text-sm opacity-60">{makeModel}</div> : null}
                  </div>
                  <div className="text-sm tabular-nums opacity-70">
                    {m.power_watts !== null ? `${formatNumber(m.power_watts, 1)} W` : null}
                    {m.purchase_cost !== null ? (
                      <span className="ml-4">{formatMoney(m.purchase_cost, currency)}</span>
                    ) : null}
                  </div>
                  <CostingBadge gaps={gaps} />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function CostingBadge({ gaps }: { gaps: string[] }) {
  if (gaps.length === 0) {
    return (
      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs">
        costing complete
      </span>
    );
  }
  return (
    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs">
      missing: {gaps.join(', ')}
    </span>
  );
}
