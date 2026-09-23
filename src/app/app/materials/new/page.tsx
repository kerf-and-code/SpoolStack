import type { Metadata } from 'next';
import { EntityForm } from '@/components/entity-form';
import { PageHeader } from '@/components/page-header';
import { PresetPicker } from '@/components/preset-picker';
import { requireUser } from '@/lib/auth';
import { MATERIAL_PRESETS, findMaterialPreset } from '@/lib/presets';
import { getCurrency, getDomainOptions } from '@/lib/settings';
import { saveMaterial } from '../actions';
import { materialFieldGroups } from '../fields';

export const metadata: Metadata = { title: 'Add material : SpoolStack' };

export default async function NewMaterialPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string | string[] }>;
}) {
  const { preset: rawPreset } = await searchParams;
  const preset = findMaterialPreset(typeof rawPreset === 'string' ? rawPreset : undefined);

  const { supabase, userId } = await requireUser();
  const [domainOptions, currency] = await Promise.all([
    getDomainOptions(supabase),
    getCurrency(supabase, userId),
  ]);

  // Only physical properties come from a preset. Cost fields stay blank.
  const prefill = preset
    ? {
        name: preset.name,
        domain_id: preset.domain_id,
        category: preset.category,
        unit: preset.unit,
        density_g_cm3: preset.density_g_cm3,
        diameter_mm: preset.diameter_mm,
      }
    : null;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Add material" back={{ href: '/app/materials', label: 'Materials' }} />
      <PresetPicker
        action="/app/materials/new"
        groups={[
          {
            label: 'Filament type',
            options: MATERIAL_PRESETS.map((p) => ({ value: p.id, label: p.label })),
          },
        ]}
        value={preset?.id ?? ''}
        label="Start from a filament type"
        note="Fills in the category, unit, typical density and 1.75 mm diameter. Add the brand and colour, and a price if you want costing."
      />
      <EntityForm
        key={preset?.id ?? 'blank'}
        action={saveMaterial.bind(null, null)}
        groups={materialFieldGroups(prefill, domainOptions, currency)}
        submitLabel="Add material"
        cancelHref="/app/materials"
        derived={{ numerator: 'package_cost', denominator: 'package_qty', unitField: 'unit', currency }}
      />
    </div>
  );
}
