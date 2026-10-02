import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/auth';
import { loadPendingImport, loadRetryContext, loadRunFormData } from '../data';
import { RunForm } from '../run-form';

export const metadata: Metadata = { title: 'Log a run : SpoolStack' };

export default async function NewRunPage({
  searchParams,
}: {
  searchParams: Promise<{ retry?: string; pending?: string; outcome?: string }>;
}) {
  const { retry, pending, outcome } = await searchParams;
  const { supabase } = await requireUser();

  // ?retry=<run id> starts a retry of that run: its settings prefilled and a
  // link back to it saved with the new run. ?pending=<id> opens a file the
  // slicer uploader sent, as if it had been imported here. Either id, when
  // not yours or no longer valid, falls back to a plain new run.
  const [retryContext, fromUpload] = await Promise.all([
    loadRetryContext(supabase, retry, true),
    loadPendingImport(supabase, pending, outcome),
  ]);
  const data = await loadRunFormData(supabase, {
    machineId: retryContext?.source?.machine_id,
    materialId: retryContext?.source?.material_id,
    projectId: retryContext?.source?.project_id,
  });

  const title = retryContext ? 'Log a retry' : fromUpload ? 'Log a sliced file' : 'Log a run';
  const back = retryContext
    ? { href: `/app/runs/${retryContext.of.id}`, label: 'Back to run' }
    : fromUpload
      ? { href: '/app', label: 'Dashboard' }
      : { href: '/app/runs', label: 'Runs' };

  return (
    <div className="max-w-3xl">
      <PageHeader title={title} back={back} />
      <RunForm data={data} retry={retryContext ?? undefined} fromUpload={fromUpload ?? undefined} />
    </div>
  );
}
