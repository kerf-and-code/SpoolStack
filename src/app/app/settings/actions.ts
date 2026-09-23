'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import {
  checkbox,
  dbErrorMessage,
  errorState,
  fieldErrorsFrom,
  formObject,
  optionalNumber,
  optionalText,
  type FormState,
} from '@/lib/forms';

const settingsSchema = z.object({
  display_name: optionalText('Display name', 80),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Currency must be a three-letter code like USD.'),
  electricity_rate_per_kwh: optionalNumber('Electricity rate', { min: 0, max: 10 }),
  labor_rate_per_hour: optionalNumber('Labor rate', { min: 0, max: 100_000 }),
});

export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const parsed = settingsSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return errorState('Check the highlighted fields.', fieldErrorsFrom(parsed.error));
  }

  const includeLabor = checkbox(formData, 'include_labor_in_cost');
  if (includeLabor && parsed.data.labor_rate_per_hour === null) {
    return errorState('Check the highlighted fields.', {
      labor_rate_per_hour: 'Set a labor rate to include your time in costs, or untick the box.',
    });
  }

  // One row per user, keyed on user_id. RLS allows insert and update of your
  // own row only, which is exactly what an upsert needs.
  const { error } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: userId, ...parsed.data, include_labor_in_cost: includeLabor },
      { onConflict: 'user_id' },
    );
  if (error) return errorState(dbErrorMessage(error, 'setting'));

  revalidatePath('/app', 'layout');
  return { status: 'saved', message: 'Settings saved. Costs everywhere use the new rates.' };
}
