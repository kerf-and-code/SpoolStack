import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ConfirmSubmit } from '@/components/confirm-submit';
import { EntityForm } from '@/components/entity-form';
import { Notice, PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/auth';
import { getCurrency } from '@/lib/settings';
import { deleteProject, saveProject, setProjectArchived } from '../actions';
import { projectFieldGroups } from '../fields';

export const metadata: Metadata = { title: 'Edit project : SpoolStack' };

const NOTICES: Record<string, string> = {
  in_use: 'This project has logged runs, so it cannot be deleted. Archive it instead: its runs stay grouped.',
  delete_failed: 'Delete failed. Nothing was removed.',
  update_failed: 'That change did not save. Reload and try again.',
};

export default async function EditProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const { notice } = await searchParams;
  const { supabase, userId } = await requireUser();

  const [{ data: project, error }, runsResult, currency] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).maybeSingle(),
    supabase.from('runs').select('*', { count: 'exact', head: true }).eq('project_id', id),
    getCurrency(supabase, userId),
  ]);

  if (error || !project) notFound();

  const archived = project.status === 'archived';
  const runCount = runsResult.count ?? 0;
  const noticeText = notice ? NOTICES[notice] : undefined;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={project.name}
        description={archived ? 'Archived. Restore it to log new runs against it.' : undefined}
        back={{ href: '/app/projects', label: 'Projects' }}
      />
      {noticeText ? <Notice tone="warn">{noticeText}</Notice> : null}

      <EntityForm
        action={saveProject.bind(null, project.id)}
        groups={projectFieldGroups(project, currency)}
        submitLabel="Save changes"
        cancelHref="/app/projects"
      />

      <section className="mt-14 border-t border-black/10 pt-8 dark:border-white/15">
        <h2 className="text-base font-semibold">{archived ? 'Restore' : 'Archive'}</h2>
        <p className="mt-1 text-sm opacity-65">
          {archived
            ? 'Makes it available for new runs again.'
            : 'For a finished project. Its runs stay grouped under it and keep their costs.'}
        </p>
        <form action={setProjectArchived.bind(null, project.id, !archived)} className="mt-3">
          <button
            type="submit"
            className="rounded-lg border border-black/15 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            {archived ? 'Restore project' : 'Archive project'}
          </button>
        </form>

        <h2 className="mt-10 text-base font-semibold">Delete</h2>
        {runCount > 0 ? (
          <p className="mt-1 text-sm opacity-65">
            Not available: {runCount} {runCount === 1 ? 'run is' : 'runs are'} grouped under this project.
            Deleting it would ungroup them. Archive it instead.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm opacity-65">
              No runs are grouped under this project, so it can be removed completely. This cannot be undone.
            </p>
            <form action={deleteProject.bind(null, project.id)} className="mt-3">
              <ConfirmSubmit
                message={`Delete ${project.name}? This cannot be undone.`}
                className="rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-700 hover:bg-red-500/10 dark:text-red-400"
              >
                Delete project
              </ConfirmSubmit>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
