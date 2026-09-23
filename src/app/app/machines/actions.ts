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
  optionalDate,
  optionalNumber,
  optionalText,
  requiredText,
  type FormState,
} from '@/lib/forms';

const machineSchema = z.object({
  name: requiredText('Name', 80),
  domain_id: requiredText('Process', 40),
  make: optionalText('Make', 80),
  model: optionalText('Model', 80),
  nozzle_diameter_mm: optionalNumber('Nozzle diameter', { positive: true, max: 10 }),
  build_volume: optionalText('Build volume', 60),
  purchase_cost: optionalNumber('Purchase cost', { min: 0, max: 10_000_000 }),
  expected_life_hours: optionalNumber('Expected life', { positive: true, max: 1_000_000 }),
  power_watts: optionalNumber('Average power draw', { min: 0, max: 100_000 }),
  maintenance_cost_per_hour: optionalNumber('Maintenance per hour', { min: 0, max: 100_000 }),
  commissioned_on: optionalDate('In service since'),
  notes: optionalText('Notes', 2000),
});

/**
 * Create when id is null, update otherwise. Bound with the id on the server
 * page, so the client form never supplies which row it is editing.
 */
export async function saveMachine(
  id: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const parsed = machineSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return errorState('Check the highlighted fields.', fieldErrorsFrom(parsed.error));
  }

  if (id) {
    // .select() so a zero-row update is visible. PostgREST answers 200 for an
    // update that matched nothing, which is what RLS produces for a row that
    // is not yours. Without the returned rows that looks exactly like success.
    const { data, error } = await supabase
      .from('machines')
      .update(parsed.data)
      .eq('id', id)
      .select('id');
    if (error) return errorState(dbErrorMessage(error, 'machine'));
    if (!data || data.length === 0) return errorState('That machine no longer exists.');
  } else {
    const { error } = await supabase.from('machines').insert({ ...parsed.data, user_id: userId });
    if (error) return errorState(dbErrorMessage(error, 'machine'));
  }

  revalidatePath('/app/machines');
  revalidatePath('/app');
  redirect('/app/machines?notice=saved');
}

export async function setMachineActive(id: string, active: boolean): Promise<void> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from('machines')
    .update({ is_active: active })
    .eq('id', id)
    .select('id');
  if (error || !data || data.length === 0) {
    redirect(`/app/machines/${id}?notice=update_failed`);
  }
  revalidatePath('/app/machines');
  revalidatePath('/app');
  redirect(`/app/machines?notice=${active ? 'restored' : 'archived'}`);
}

export type QuickMachineResult =
  | {
      ok: true;
      machine: { id: string; name: string; domain_id: string; make: string | null; model: string | null };
    }
  | { ok: false; message: string };

/**
 * One-tap machine creation from a gcode import, without leaving the run form
 * (which would lose the imported values). Name and model come from the
 * file's printer_model; the cost fields stay blank and show as missing on the
 * Machines page, so nothing is guessed.
 */
export async function createMachineFromImport(printerModel: string): Promise<QuickMachineResult> {
  const { supabase, userId } = await requireUser();
  const name = String(printerModel ?? '').trim().slice(0, 80);
  if (name.length < 2) return { ok: false, message: 'The file did not name a printer.' };

  const columns = 'id, name, domain_id, make, model';
  const { data, error } = await supabase
    .from('machines')
    .insert({ user_id: userId, domain_id: 'fdm', name, model: name })
    .select(columns)
    .single();

  if (error) {
    if (error.code === '23505') {
      // Same name already exists. Use it if active; an archived one needs a
      // deliberate restore, not a silent resurrection.
      const { data: existing } = await supabase
        .from('machines')
        .select(`${columns}, is_active`)
        .eq('name', name)
        .maybeSingle();
      if (existing?.is_active) {
        return {
          ok: true,
          machine: {
            id: existing.id,
            name: existing.name,
            domain_id: existing.domain_id,
            make: existing.make,
            model: existing.model,
          },
        };
      }
      if (existing) {
        return { ok: false, message: `You have an archived machine named ${name}. Restore it on the Machines page to use it.` };
      }
    }
    return { ok: false, message: dbErrorMessage(error, 'machine') };
  }

  revalidatePath('/app/machines');
  return { ok: true, machine: data };
}

/**
 * Hard delete, only for a machine no run has used. runs.machine_id is
 * ON DELETE SET NULL, so deleting a used machine would silently strip it from
 * every run it appears on and those runs would lose their energy and wear
 * cost. Archive is the answer for anything with history; this re-checks on
 * the server even though the page already hides the button.
 */
export async function deleteMachine(id: string): Promise<void> {
  const { supabase } = await requireUser();

  const { count, error: countError } = await supabase
    .from('runs')
    .select('*', { count: 'exact', head: true })
    .eq('machine_id', id);
  if (countError) redirect(`/app/machines/${id}?notice=delete_failed`);
  if ((count ?? 0) > 0) redirect(`/app/machines/${id}?notice=in_use`);

  const { data, error } = await supabase.from('machines').delete().eq('id', id).select('id');
  if (error || !data || data.length === 0) {
    redirect(`/app/machines/${id}?notice=delete_failed`);
  }

  revalidatePath('/app/machines');
  revalidatePath('/app');
  redirect('/app/machines?notice=deleted');
}
