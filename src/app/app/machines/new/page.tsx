import type { Metadata } from 'next';
import { EntityForm } from '@/components/entity-form';
import { PageHeader } from '@/components/page-header';
import { PresetPicker, type PresetGroup } from '@/components/preset-picker';
import { requireUser } from '@/lib/auth';
import { MACHINE_PRESETS, findMachinePreset, machinePresetLabel } from '@/lib/presets';
import { getCurrency, getDomainOptions } from '@/lib/settings';
import { saveMachine } from '../actions';
import { machineFieldGroups } from '../fields';

export const metadata: Metadata = { title: 'Add machine : SpoolStack' };

// Presets grouped by make, in the order they are listed in presets.ts.
function machinePresetGroups(): PresetGroup[] {
  const groups: PresetGroup[] = [];
  for (const p of MACHINE_PRESETS) {
    let group = groups.find((g) => g.label === p.make);
    if (!group) {
      group = { label: p.make, options: [] };
      groups.push(group);
    }
    group.options.push({ value: p.id, label: machinePresetLabel(p) });
  }
  return groups;
}

export default async function NewMachinePage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string | string[] }>;
}) {
  const { preset: rawPreset } = await searchParams;
  const preset = findMachinePreset(typeof rawPreset === 'string' ? rawPreset : undefined);

  const { supabase, userId } = await requireUser();
  const [domainOptions, currency] = await Promise.all([
    getDomainOptions(supabase),
    getCurrency(supabase, userId),
  ]);

  // Only physical specs come from a preset. Every costing field stays blank.
  const prefill = preset
    ? {
        name: machinePresetLabel(preset),
        domain_id: preset.domain_id,
        make: preset.make,
        model: preset.model,
        build_volume: preset.build_volume,
        nozzle_diameter_mm: preset.nozzle_diameter_mm,
      }
    : null;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Add machine" back={{ href: '/app/machines', label: 'Machines' }} />
      <PresetPicker
        action="/app/machines/new"
        groups={machinePresetGroups()}
        value={preset?.id ?? ''}
        label="Start from a common printer"
        note="Fills in the make, model, build volume and stock nozzle. Costing is left for you: prices and real power draw vary too much to guess."
      />
      <EntityForm
        key={preset?.id ?? 'blank'}
        action={saveMachine.bind(null, null)}
        groups={machineFieldGroups(prefill, domainOptions, currency)}
        submitLabel="Add machine"
        cancelHref="/app/machines"
      />
    </div>
  );
}
