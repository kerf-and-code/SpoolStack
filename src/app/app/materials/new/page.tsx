import type { Metadata } from 'next';
import { EntityForm } from '@/components/entity-form';
import { PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/auth';
import { getCurrency, getDomainOptions } from '@/lib/settings';
import { saveMaterial } from '../actions';
import { materialFieldGroups } from '../fields';

export const metadata: Metadata = { title: 'Add material : SpoolStack' };

export default async function NewMaterialPage() {
  const { supabase, userId } = await requireUser();
  const [domainOptions, currency] = await Promise.all([
    getDomainOptions(supabase),
    getCurrency(supabase, userId),
  ]);

  return (
    <div className="max-w-2xl">
      <PageHeader title="Add material" back={{ href: '/app/materials', label: 'Materials' }} />
      <EntityForm
        action={saveMaterial.bind(null, null)}
        groups={materialFieldGroups(null, domainOptions, currency)}
        submitLabel="Add material"
        cancelHref="/app/materials"
        derived={{ numerator: 'package_cost', denominator: 'package_qty', unitField: 'unit', currency }}
      />
    </div>
  );
}
