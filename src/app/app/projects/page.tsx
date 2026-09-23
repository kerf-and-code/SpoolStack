import type { Metadata } from 'next';
import Link from 'next/link';
import { Notice, PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/auth';
import { formatMoney, formatNumber } from '@/lib/format';
import { getCurrency } from '@/lib/settings';

export const metadata: Metadata = { title: 'Projects : SpoolStack' };

const NOTICES: Record<string, { tone: 'ok' | 'warn'; text: string }> = {
  saved: { tone: 'ok', text: 'Project saved.' },
  archived: { tone: 'ok', text: 'Project archived. Its runs stay grouped under it.' },
  restored: { tone: 'ok', text: 'Project restored.' },
  deleted: { tone: 'ok', text: 'Project deleted.' },
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; notice?: string }>;
}) {
  const { supabase, userId } = await requireUser();
  const params = await searchParams;
  const showArchived = params.show === 'archived';

  const [{ data: projects, error }, currency] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, client, sale_price, target_quantity')
      .eq('status', showArchived ? 'archived' : 'active')
      .order('name'),
    getCurrency(supabase, userId),
  ]);

  const notice = params.notice ? NOTICES[params.notice] : undefined;

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Optional. Group runs that make the same thing, so costing can answer per-product questions."
        action={{ href: '/app/projects/new', label: 'Add project' }}
      />
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      {error ? <Notice tone="error">Could not load projects: {error.message}</Notice> : null}

      <div className="mb-4 flex gap-4 text-sm">
        <Link href="/app/projects" className={showArchived ? 'opacity-60 hover:opacity-100' : 'font-medium'}>
          Active
        </Link>
        <Link
          href="/app/projects?show=archived"
          className={showArchived ? 'font-medium' : 'opacity-60 hover:opacity-100'}
        >
          Archived
        </Link>
      </div>

      {projects && projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/20 p-8 text-center text-sm dark:border-white/25">
          {showArchived ? (
            <p className="opacity-70">No archived projects.</p>
          ) : (
            <>
              <p className="opacity-70">No projects yet. Runs do not need one.</p>
              <Link href="/app/projects/new" className="mt-3 inline-block font-medium underline underline-offset-2">
                Add a project
              </Link>
            </>
          )}
        </div>
      ) : null}

      {projects && projects.length > 0 ? (
        <ul className="divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/15 dark:border-white/15">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/app/projects/${p.id}`}
                className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.name}</div>
                  {p.client ? <div className="text-sm opacity-60">{p.client}</div> : null}
                </div>
                <div className="text-sm tabular-nums opacity-70">
                  {p.sale_price !== null ? `${formatMoney(p.sale_price, currency)} each` : null}
                  {p.target_quantity !== null ? (
                    <span className="ml-4">target {formatNumber(p.target_quantity, 0)}</span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
