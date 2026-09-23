// Field layout for the machine form, shared by /new and /[id].

import type { FieldGroup } from '@/components/entity-form';
import type { Tables } from '@/lib/database.types';
import { inputValue } from '@/lib/format';

export type MachineRow = Tables<'machines'>;

export function machineFieldGroups(
  machine: Partial<MachineRow> | null,
  domainOptions: { value: string; label: string }[],
  currency: string,
): FieldGroup[] {
  return [
    {
      title: 'The machine',
      fields: [
        {
          name: 'name',
          label: 'Name',
          kind: 'text',
          required: true,
          maxLength: 80,
          placeholder: 'Garage P1S',
          defaultValue: inputValue(machine?.name),
          help: 'What you call it. Must be unique among your machines.',
        },
        {
          name: 'domain_id',
          label: 'Process',
          kind: 'select',
          required: true,
          options: domainOptions,
          defaultValue: machine?.domain_id ?? domainOptions[0]?.value ?? 'fdm',
        },
        { name: 'make', label: 'Make', kind: 'text', maxLength: 80, placeholder: 'Bambu Lab', defaultValue: inputValue(machine?.make) },
        { name: 'model', label: 'Model', kind: 'text', maxLength: 80, placeholder: 'P1S', defaultValue: inputValue(machine?.model) },
        {
          name: 'nozzle_diameter_mm',
          label: 'Nozzle diameter',
          kind: 'number',
          suffix: 'mm',
          placeholder: '0.4',
          defaultValue: inputValue(machine?.nozzle_diameter_mm),
        },
        {
          name: 'build_volume',
          label: 'Build volume',
          kind: 'text',
          maxLength: 60,
          placeholder: '256 x 256 x 256 mm',
          defaultValue: inputValue(machine?.build_volume),
        },
      ],
    },
    {
      title: 'Costing',
      description:
        'All optional. Anything left blank is reported as a missing input on costed runs rather than guessed, so you can fill these in later and every past run recosts.',
      fields: [
        {
          name: 'purchase_cost',
          label: 'Purchase cost',
          kind: 'number',
          costing: true,
          suffix: currency,
          placeholder: '699',
          defaultValue: inputValue(machine?.purchase_cost),
          help: 'What you paid, including any upgrades that are part of the machine now.',
        },
        {
          name: 'expected_life_hours',
          label: 'Expected life',
          kind: 'number',
          costing: true,
          suffix: 'hours',
          placeholder: '5000',
          defaultValue: inputValue(machine?.expected_life_hours),
          help: 'Hours of printing before you would replace it. Purchase cost spread over this is the wear cost per hour.',
        },
        {
          name: 'power_watts',
          label: 'Average power draw',
          kind: 'number',
          costing: true,
          suffix: 'W',
          placeholder: '110',
          defaultValue: inputValue(machine?.power_watts),
          help: 'Average while printing, not the nameplate figure, which overstates it badly. A plug-in power meter gives the real number.',
        },
        {
          name: 'maintenance_cost_per_hour',
          label: 'Maintenance per hour',
          kind: 'number',
          costing: true,
          suffix: `${currency}/h`,
          placeholder: '0.02',
          defaultValue: inputValue(machine?.maintenance_cost_per_hour),
          help: 'Nozzles, PEI sheets, belts, spread per printing hour. Leave blank if you do not track it.',
        },
        {
          name: 'commissioned_on',
          label: 'In service since',
          kind: 'date',
          defaultValue: inputValue(machine?.commissioned_on),
        },
      ],
    },
    {
      title: 'Notes',
      fields: [
        {
          name: 'notes',
          label: 'Notes',
          kind: 'textarea',
          maxLength: 2000,
          placeholder: 'Firmware version, mods, quirks.',
          defaultValue: inputValue(machine?.notes),
        },
      ],
    },
  ];
}

/** What is still missing before this machine's runs can be fully costed. */
export function machineCostingGaps(m: Pick<MachineRow, 'power_watts' | 'purchase_cost' | 'expected_life_hours'>): string[] {
  const gaps: string[] = [];
  if (m.power_watts === null) gaps.push('power draw');
  if (m.purchase_cost === null || m.expected_life_hours === null) gaps.push('depreciation');
  return gaps;
}
