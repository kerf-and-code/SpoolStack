import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/auth';
import { loadRetryContext, loadRunFormData } from '../data';
import { RunForm } from '../run-form';

export const metadata: Metadata = { title: 'Log a run : SpoolStack' };

export default async function NewRunPage({ searchParams }: { searchParams: Promise<{ retry?: string }> }) {
  const { retry } = await searchParams;
  const { supabase } = await requireUser();

  // ?retry=<run id> starts a retry of that run: its settings prefilled and a
  // link back to it saved with the new run. An id that is not yours, or no
  // longer exists, falls back to a plain new run.
  const retryContext = await loadRetryContext(supabase, retry, true);
  const data = await loadRunFormData(supabase, {
    machineId: retryContext?.source?.machine_id,
    materialId: retryContext?.source?.material_id,
    projectId: retryContext?.source?.project_id,
  });

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={retryContext ? 'Log a retry' : 'Log a run'}
        back={retryContext ? { href: `/app/runs/${retryContext.of.id}`, label: 'Back to run' } : { href: '/app/runs', label: 'Runs' }}
      />
      <RunForm data={data} retry={retryContext ?? undefined} />
    </div>
  );
}
