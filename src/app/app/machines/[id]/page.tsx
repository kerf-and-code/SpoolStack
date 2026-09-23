import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ConfirmSubmit } from '@/components/confirm-submit';
import { EntityForm } from '@/components/entity-form';
import { Notice, PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/auth';
import { getCurrency, getDomainOptions } from '@/lib/settings';
import { deleteMachine, saveMachine, setMachineActive } from '../actions';
import { machineFieldGroups } from '../fields';

export const metadata: Metadata = { title: 'Edit machine : SpoolStack' };

const NOTICES: Record<string, string> = {
  in_use: 'This machine has logged runs, so it cannot be deleted. Archive it instead: its runs keep their costs.',
  delete_failed: 'Delete failed. Nothing was removed.',
  update_failed: 'That change did not save. Reload and try again.',
};

export default async function EditMachinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const { notice } = await searchParams;
  const { supabase, userId } = await requireUser();

  const [{ data: machine, error }, runsResult, domainOptions, currency] = await Promise.all([
    supabase.from('machines').select('*').eq('id', id).maybeSingle(),
    supabase.from('runs').select('*', { count: 'exact', head: true }).eq('machine_id', id),
    getDomainOptions(supabase),
    getCurrency(supabase, userId),
  ]);

  // A malformed id comes back as a Postgres cast error, a foreign id as no row
  // (RLS). Both are "not yours to see".
  if (error || !machine) notFound();

  const runCount = runsResult.count ?? 0;
  const noticeText = notice ? NOTICES[notice] : undefined;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={machine.name}
        description={machine.is_active ? undefined : 'Archived. Restore it to use it for new runs.'}
        back={{ href: '/app/machines', label: 'Machines' }}
      />
      {noticeText ? <Notice tone="warn">{noticeText}</Notice> : null}

      <EntityForm
        action={saveMachine.bind(null, machine.id)}
        groups={machineFieldGroups(machine, domainOptions, currency)}
        submitLabel="Save changes"
        cancelHref="/app/machines"
      />

      <section className="mt-14 border-t border-black/10 pt-8 dark:border-white/15">
        <h2 className="text-base font-semibold">{machine.is_active ? 'Archive' : 'Restore'}</h2>
        <p className="mt-1 text-sm opacity-65">
          {machine.is_active
            ? 'Hides it from pickers when logging new runs. Past runs keep it and stay fully costed.'
            : 'Makes it available for new runs again.'}
        </p>
        <form action={setMachineActive.bind(null, machine.id, !machine.is_active)} className="mt-3">
          <button
            type="submit"
            className="rounded-lg border border-black/15 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            {machine.is_active ? 'Archive machine' : 'Restore machine'}
          </button>
        </form>

        <h2 className="mt-10 text-base font-semibold">Delete</h2>
        {runCount > 0 ? (
          <p className="mt-1 text-sm opacity-65">
            Not available: {runCount} {runCount === 1 ? 'run uses' : 'runs use'} this machine. Deleting it
            would strip it from those runs and lose their energy and wear costs. Archive it instead.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm opacity-65">
              No runs use this machine, so it can be removed completely. This cannot be undone.
            </p>
            <form action={deleteMachine.bind(null, machine.id)} className="mt-3">
              <ConfirmSubmit
                message={`Delete ${machine.name}? This cannot be undone.`}
                className="rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-700 hover:bg-red-500/10 dark:text-red-400"
              >
                Delete machine
              </ConfirmSubmit>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
