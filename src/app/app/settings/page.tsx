import type { Metadata } from 'next';
import { EntityForm, type FieldGroup } from '@/components/entity-form';
import { PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/auth';
import { inputValue } from '@/lib/format';
import { saveSettings } from './actions';

export const metadata: Metadata = { title: 'Settings : SpoolStack' };

const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'NZD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK', 'MXN', 'BRL', 'INR'];

export default async function SettingsPage() {
  const { supabase, userId } = await requireUser();
  const { data: settings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  // Keep an unlisted currency selectable rather than silently switching it.
  const currency = settings?.currency ?? 'USD';
  const currencyOptions = (CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES]).map((c) => ({
    value: c,
    label: c,
  }));

  const groups: FieldGroup[] = [
    {
      title: 'Rates',
      description:
        'These apply to every run, past and future: costs are worked out when you look at them, from these values, so changing a rate here recosts your whole history.',
      fields: [
        {
          name: 'currency',
          label: 'Currency',
          kind: 'select',
          required: true,
          options: currencyOptions,
          defaultValue: currency,
        },
        {
          name: 'electricity_rate_per_kwh',
          label: 'Electricity rate',
          kind: 'number',
          costing: true,
          suffix: `${currency}/kWh`,
          placeholder: '0.12',
          defaultValue: inputValue(settings?.electricity_rate_per_kwh),
          help: 'The per-kWh energy charge on your power bill. Blank means energy cost is reported as missing.',
        },
        {
          name: 'labor_rate_per_hour',
          label: 'Labor rate',
          kind: 'number',
          costing: true,
          suffix: `${currency}/h`,
          placeholder: '25',
          defaultValue: inputValue(settings?.labor_rate_per_hour),
          help: 'What an hour of your hands-on time is worth: setup, removal, post-processing. Not print time.',
        },
        {
          name: 'include_labor_in_cost',
          label: 'Include my time in costs',
          kind: 'checkbox',
          defaultValue: settings?.include_labor_in_cost ? 'on' : '',
          help: 'Off by default: hobby costs usually leave your own time out. Turn it on when you are pricing work to sell.',
        },
      ],
    },
    {
      title: 'Profile',
      fields: [
        {
          name: 'display_name',
          label: 'Display name',
          kind: 'text',
          maxLength: 80,
          defaultValue: inputValue(settings?.display_name),
        },
      ],
    },
  ];

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" description="The rates every cost in SpoolStack is calculated from." />
      <EntityForm action={saveSettings} groups={groups} submitLabel="Save settings" />
    </div>
  );
}
