import type { Metadata } from 'next';
import { EntityForm } from '@/components/entity-form';
import { PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/auth';
import { getCurrency, getDomainOptions } from '@/lib/settings';
import { saveMachine } from '../actions';
import { machineFieldGroups } from '../fields';

export const metadata: Metadata = { title: 'Add machine : SpoolStack' };

export default async function NewMachinePage() {
  const { supabase, userId } = await requireUser();
  const [domainOptions, currency] = await Promise.all([
    getDomainOptions(supabase),
    getCurrency(supabase, userId),
  ]);

  return (
    <div className="max-w-2xl">
      <PageHeader title="Add machine" back={{ href: '/app/machines', label: 'Machines' }} />
      <EntityForm
        action={saveMachine.bind(null, null)}
        groups={machineFieldGroups(null, domainOptions, currency)}
        submitLabel="Add machine"
        cancelHref="/app/machines"
      />
    </div>
  );
}
