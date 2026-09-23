// Field layout for the material form, shared by /new and /[id].

import type { FieldGroup } from '@/components/entity-form';
import type { Tables } from '@/lib/database.types';
import { inputValue } from '@/lib/format';
import { MATERIAL_DENSITY_G_CM3 } from '@/lib/gcodeParse';

export type MaterialRow = Tables<'materials'>;

/** Must match the CHECK constraint on materials.unit in db/schema.sql. */
export const MATERIAL_UNITS = ['g', 'kg', 'ml', 'l', 'mm', 'm', 'cm3', 'sheet', 'each'] as const;

const UNIT_LABELS: Record<(typeof MATERIAL_UNITS)[number], string> = {
  g: 'grams (g)',
  kg: 'kilograms (kg)',
  ml: 'millilitres (ml)',
  l: 'litres (l)',
  mm: 'millimetres (mm)',
  m: 'metres (m)',
  cm3: 'cubic centimetres (cm3)',
  sheet: 'sheets',
  each: 'each',
};

/**
 * The same category spellings the gcode importer looks up. Suggesting these
 * means a material typed as "PETG" matches a file that says filament_type =
 * PETG, and gets auto-selected on import.
 */
const CATEGORY_SUGGESTIONS = Object.keys(MATERIAL_DENSITY_G_CM3);

export function materialFieldGroups(
  material: Partial<MaterialRow> | null,
  domainOptions: { value: string; label: string }[],
  currency: string,
): FieldGroup[] {
  return [
    {
      title: 'The material',
      fields: [
        {
          name: 'name',
          label: 'Name',
          kind: 'text',
          required: true,
          maxLength: 100,
          placeholder: 'Prusament PLA Galaxy Black',
          defaultValue: inputValue(material?.name),
          help: 'Specific enough to tell spools apart. Must be unique among your materials.',
        },
        {
          name: 'domain_id',
          label: 'Process',
          kind: 'select',
          required: true,
          options: domainOptions,
          defaultValue: material?.domain_id ?? domainOptions[0]?.value ?? 'fdm',
        },
        {
          name: 'category',
          label: 'Category',
          kind: 'text',
          maxLength: 40,
          placeholder: 'PLA',
          suggestions: CATEGORY_SUGGESTIONS,
          defaultValue: inputValue(material?.category),
          help: 'The base polymer. Gcode imports match on this to pick the material for you.',
        },
        { name: 'brand', label: 'Brand', kind: 'text', maxLength: 80, placeholder: 'Prusament', defaultValue: inputValue(material?.brand) },
        { name: 'color', label: 'Colour', kind: 'text', maxLength: 60, placeholder: 'Galaxy Black', defaultValue: inputValue(material?.color) },
        {
          name: 'unit',
          label: 'Measured in',
          kind: 'select',
          required: true,
          options: MATERIAL_UNITS.map((u) => ({ value: u, label: UNIT_LABELS[u] })),
          defaultValue: material?.unit ?? 'g',
          help: 'The unit a run records how much it used. Grams for filament.',
        },
      ],
    },
    {
      title: 'Cost',
      description:
        'Either the package cost and quantity, or the cost per unit directly. Leave all three blank if you do not know yet: runs will show material cost as missing, not as free.',
      fields: [
        {
          name: 'package_cost',
          label: 'Package cost',
          kind: 'number',
          costing: true,
          suffix: currency,
          placeholder: '24.99',
          defaultValue: inputValue(material?.package_cost),
          help: 'What one spool or pack cost you, shipping included if you want honest numbers.',
        },
        {
          name: 'package_qty',
          label: 'Package quantity',
          kind: 'number',
          costing: true,
          placeholder: '1000',
          defaultValue: inputValue(material?.package_qty),
          help: 'In the unit above. 1000 for a 1 kg spool measured in grams.',
        },
        {
          name: 'cost_per_unit',
          label: 'Cost per unit',
          kind: 'number',
          costing: true,
          suffix: currency,
          placeholder: '0.025',
          defaultValue: inputValue(material?.cost_per_unit),
          help: 'Only used when package cost and quantity are blank. Otherwise it is recalculated from them on save.',
        },
      ],
    },
    {
      title: 'Filament properties',
      description:
        'Only needed when a gcode file reports filament length instead of weight, which Cura does. Blank means the importer uses the typical value for the category.',
      fields: [
        {
          name: 'density_g_cm3',
          label: 'Density',
          kind: 'number',
          suffix: 'g/cm3',
          placeholder: '1.24',
          defaultValue: inputValue(material?.density_g_cm3),
          help: 'Typical: PLA 1.24, PETG 1.27, ABS 1.04, TPU 1.21.',
        },
        {
          name: 'diameter_mm',
          label: 'Filament diameter',
          kind: 'number',
          suffix: 'mm',
          placeholder: '1.75',
          defaultValue: inputValue(material?.diameter_mm),
        },
        {
          name: 'spool_weight_g',
          label: 'Empty spool weight',
          kind: 'number',
          suffix: 'g',
          placeholder: '250',
          defaultValue: inputValue(material?.spool_weight_g),
          help: 'Lets you weigh a spool on a kitchen scale and know what is left.',
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
          placeholder: 'Where you bought it, how it prints, whether it needs drying.',
          defaultValue: inputValue(material?.notes),
        },
      ],
    },
  ];
}
