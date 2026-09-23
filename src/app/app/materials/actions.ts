'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import {
  dbErrorMessage,
  errorState,
  fieldErrorsFrom,
  formObject,
  optionalNumber,
  optionalText,
  requiredText,
  type FormState,
} from '@/lib/forms';
import { MATERIAL_UNITS } from './fields';

const materialSchema = z
  .object({
    name: requiredText('Name', 100),
    domain_id: requiredText('Process', 40),
    category: optionalText('Category', 40),
    brand: optionalText('Brand', 80),
    color: optionalText('Colour', 60),
    unit: z.enum(MATERIAL_UNITS, { error: 'Pick a unit from the list.' }),
    package_cost: optionalNumber('Package cost', { min: 0, max: 1_000_000 }),
    package_qty: optionalNumber('Package quantity', { positive: true, max: 100_000_000 }),
    cost_per_unit: optionalNumber('Cost per unit', { min: 0, max: 100_000 }),
    density_g_cm3: optionalNumber('Density', { positive: true, max: 25 }),
    diameter_mm: optionalNumber('Filament diameter', { positive: true, max: 10 }),
    spool_weight_g: optionalNumber('Empty spool weight', { min: 0, max: 100_000 }),
    notes: optionalText('Notes', 2000),
  })
  .superRefine((v, ctx) => {
    // Half a package is worse than none: cost with no quantity (or the
    // reverse) cannot produce a per-unit price, and silently ignoring the one
    // that was typed would lose it.
    if (v.package_cost !== null && v.package_qty === null) {
      ctx.addIssue({ code: 'custom', path: ['package_qty'], message: 'Enter the quantity too, or clear the package cost.' });
    }
    if (v.package_qty !== null && v.package_cost === null) {
      ctx.addIssue({ code: 'custom', path: ['package_cost'], message: 'Enter the cost too, or clear the package quantity.' });
    }
  });

/**
 * cost_per_unit is the single column run_cost_breakdown reads. When a package
 * is given, it is derived HERE, on the server, from the package fields, never
 * taken from the browser's live readout.
 */
function withDerivedCost<T extends { package_cost: number | null; package_qty: number | null; cost_per_unit: number | null }>(
  v: T,
): T {
  if (v.package_cost !== null && v.package_qty !== null && v.package_qty > 0) {
    return { ...v, cost_per_unit: Math.round((v.package_cost / v.package_qty) * 10_000) / 10_000 };
  }
  return v;
}

export async function saveMaterial(
  id: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const parsed = materialSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return errorState('Check the highlighted fields.', fieldErrorsFrom(parsed.error));
  }
  const values = withDerivedCost(parsed.data);

  if (id) {
    const { data, error } = await supabase.from('materials').update(values).eq('id', id).select('id');
    if (error) return errorState(dbErrorMessage(error, 'material'));
    if (!data || data.length === 0) return errorState('That material no longer exists.');
  } else {
    const { error } = await supabase.from('materials').insert({ ...values, user_id: userId });
    if (error) return errorState(dbErrorMessage(error, 'material'));
  }

  revalidatePath('/app/materials');
  revalidatePath('/app');
  redirect('/app/materials?notice=saved');
}

export async function setMaterialActive(id: string, active: boolean): Promise<void> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from('materials')
    .update({ is_active: active })
    .eq('id', id)
    .select('id');
  if (error || !data || data.length === 0) {
    redirect(`/app/materials/${id}?notice=update_failed`);
  }
  revalidatePath('/app/materials');
  revalidatePath('/app');
  redirect(`/app/materials?notice=${active ? 'restored' : 'archived'}`);
}

/** Same rule as machines: runs.material_id is ON DELETE SET NULL, so a used material is archived, not deleted. */
export async function deleteMaterial(id: string): Promise<void> {
  const { supabase } = await requireUser();

  const { count, error: countError } = await supabase
    .from('runs')
    .select('*', { count: 'exact', head: true })
    .eq('material_id', id);
  if (countError) redirect(`/app/materials/${id}?notice=delete_failed`);
  if ((count ?? 0) > 0) redirect(`/app/materials/${id}?notice=in_use`);

  const { data, error } = await supabase.from('materials').delete().eq('id', id).select('id');
  if (error || !data || data.length === 0) {
    redirect(`/app/materials/${id}?notice=delete_failed`);
  }

  revalidatePath('/app/materials');
  revalidatePath('/app');
  redirect('/app/materials?notice=deleted');
}
