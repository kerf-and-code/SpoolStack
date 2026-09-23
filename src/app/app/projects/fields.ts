// Field layout for the project form, shared by /new and /[id].

import type { FieldGroup } from '@/components/entity-form';
import type { Tables } from '@/lib/database.types';
import { inputValue } from '@/lib/format';

export type ProjectRow = Tables<'projects'>;

export function projectFieldGroups(project: ProjectRow | null, currency: string): FieldGroup[] {
  return [
    {
      title: 'The project',
      fields: [
        {
          name: 'name',
          label: 'Name',
          kind: 'text',
          required: true,
          maxLength: 100,
          placeholder: 'Dice towers',
          defaultValue: inputValue(project?.name),
          help: 'Groups runs that make the same thing. Must be unique among your projects.',
        },
        {
          name: 'client',
          label: 'Client',
          kind: 'text',
          maxLength: 100,
          placeholder: 'Etsy shop, a friend, yourself',
          defaultValue: inputValue(project?.client),
        },
        {
          name: 'description',
          label: 'Description',
          kind: 'textarea',
          maxLength: 2000,
          defaultValue: inputValue(project?.description),
        },
      ],
    },
    {
      title: 'If you sell it',
      description:
        'Both optional. Filled in, they let costing show your margin per unit and how cost falls as batch size grows toward your target.',
      fields: [
        {
          name: 'sale_price',
          label: 'Sale price per unit',
          kind: 'number',
          costing: true,
          suffix: currency,
          placeholder: '18.00',
          defaultValue: inputValue(project?.sale_price),
        },
        {
          name: 'target_quantity',
          label: 'Target quantity',
          kind: 'number',
          costing: true,
          suffix: 'units',
          placeholder: '50',
          defaultValue: inputValue(project?.target_quantity),
          help: 'How many you plan to make in total.',
        },
      ],
    },
  ];
}
