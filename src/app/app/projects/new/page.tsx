import type { Metadata } from 'next';
import { EntityForm } from '@/components/entity-form';
import { PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/auth';
import { getCurrency } from '@/lib/settings';
import { saveProject } from '../actions';
import { projectFieldGroups } from '../fields';

export const metadata: Metadata = { title: 'Add project : SpoolStack' };

export default async function NewProjectPage() {
  const { supabase, userId } = await requireUser();
  const currency = await getCurrency(supabase, userId);

  return (
    <div className="max-w-2xl">
      <PageHeader title="Add project" back={{ href: '/app/projects', label: 'Projects' }} />
      <EntityForm
        action={saveProject.bind(null, null)}
        groups={projectFieldGroups(null, currency)}
        submitLabel="Add project"
        cancelHref="/app/projects"
      />
    </div>
  );
}
