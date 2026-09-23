import type { Metadata } from 'next';
import Link from 'next/link';
import { Notice, PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/auth';
import { formatMoney } from '@/lib/format';
import { getCurrency } from '@/lib/settings';

export const metadata: Metadata = { title: 'Materials : SpoolStack' };

const NOTICES: Record<string, { tone: 'ok' | 'warn'; text: string }> = {
  saved: { tone: 'ok', text: 'Material saved.' },
  archived: { tone: 'ok', text: 'Material archived. Its runs keep it, and it no longer appears in pickers.' },
  restored: { tone: 'ok', text: 'Material restored.' },
  deleted: { tone: 'ok', text: 'Material deleted.' },
};

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; notice?: string }>;
}) {
  const { supabase, userId } = await requireUser();
  const params = await searchParams;
  const showArchived = params.show === 'archived';

  const [{ data: materials, error }, currency] = await Promise.all([
    supabase
      .from('materials')
      .select('id, name, category, brand, color, unit, cost_per_unit')
      .eq('is_active', !showArchived)
      .order('name'),
    getCurrency(supabase, userId),
  ]);

  const notice = params.notice ? NOTICES[params.notice] : undefined;

  return (
    <div>
      <PageHeader
        title="Materials"
        description="Filaments and other stock. The cost per unit here is what every run is priced with."
        action={{ href: '/app/materials/new', label: 'Add material' }}
      />
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      {error ? <Notice tone="error">Could not load materials: {error.message}</Notice> : null}

      <div className="mb-4 flex gap-4 text-sm">
        <Link href="/app/materials" className={showArchived ? 'opacity-60 hover:opacity-100' : 'font-medium'}>
          Active
        </Link>
        <Link
          href="/app/materials?show=archived"
          className={showArchived ? 'font-medium' : 'opacity-60 hover:opacity-100'}
        >
          Archived
        </Link>
      </div>

      {materials && materials.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/20 p-8 text-center text-sm dark:border-white/25">
          {showArchived ? (
            <p className="opacity-70">No archived materials.</p>
          ) : (
            <>
              <p className="opacity-70">No materials yet.</p>
              <Link href="/app/materials/new" className="mt-3 inline-block font-medium underline underline-offset-2">
                Add your first filament
              </Link>
            </>
          )}
        </div>
      ) : null}

      {materials && materials.length > 0 ? (
        <ul className="divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/15 dark:border-white/15">
          {materials.map((m) => {
            const detail = [m.category, m.brand, m.color].filter(Boolean).join(' / ');
            return (
              <li key={m.id}>
                <Link
                  href={`/app/materials/${m.id}`}
                  className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{m.name}</div>
                    {detail ? <div className="text-sm opacity-60">{detail}</div> : null}
                  </div>
                  {m.cost_per_unit !== null ? (
                    <div className="text-sm tabular-nums opacity-70">
                      {formatMoney(m.cost_per_unit, currency, 4)} / {m.unit}
                    </div>
                  ) : (
                    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs">
                      missing: cost
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
