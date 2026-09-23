import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/auth';
import { loadRunFormData } from '../data';
import { RunForm } from '../run-form';

export const metadata: Metadata = { title: 'Log a run : SpoolStack' };

export default async function NewRunPage() {
  const { supabase } = await requireUser();
  const data = await loadRunFormData(supabase);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Log a run" back={{ href: '/app/runs', label: 'Runs' }} />
      <RunForm data={data} />
    </div>
  );
}
