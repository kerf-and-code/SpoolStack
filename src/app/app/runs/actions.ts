'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import type { Json } from '@/lib/database.types';
import { parseDurationMinutes } from '@/lib/duration';
import {
  dbErrorMessage,
  errorState,
  fieldErrorsFrom,
  formObject,
  optionalNumber,
  optionalText,
  type FieldErrors,
  type FormState,
} from '@/lib/forms';
import { parseParameterFields } from '@/lib/run-params';
import type { ServerClient } from '@/lib/supabase/server';
import { OUTCOMES } from './types';

const optionalId = (label: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v ?? null),
    z
      .string()
      .regex(/^[0-9a-f-]{36}$/i, `${label} is not valid. Reload and pick again.`)
      .nullable(),
  );

const runSchema = z.object({
  domain_id: z.string().trim().min(1).max(40).default('fdm'),
  machine_id: optionalId('Machine'),
  material_id: optionalId('Material'),
  project_id: optionalId('Project'),
  title: optionalText('Title', 120),
  material_qty_used: optionalNumber('Material used', { min: 0, max: 10_000_000 }),
  units_produced: optionalNumber('Parts on the plate', { positive: true, integer: true, max: 100_000 }),
  units_good: optionalNumber('Usable parts', { min: 0, integer: true, max: 100_000 }),
  outcome: z.enum(OUTCOMES, { error: 'Pick how the run went.' }),
  quality_rating: optionalNumber('Quality', { min: 1, max: 5, integer: true }),
  active_labor_minutes: optionalNumber('Hands-on time', { min: 0, max: 43_200 }),
  notes: optionalText('Notes', 4000),
});

const UUID = /^[0-9a-f-]{36}$/i;

type DefectRow = { defect_type_id: number; severity: number | null };

/** The run columns a form submission controls. Source, owner and finish time are handled per mode. */
interface RunFields {
  domain_id: string;
  machine_id: string | null;
  material_id: string | null;
  project_id: string | null;
  title: string | null;
  duration_minutes: number | null;
  material_qty_used: number | null;
  material_qty_estimated: boolean;
  active_labor_minutes: number;
  units_produced: number;
  units_good: number;
  outcome: string;
  quality_rating: number | null;
  parameters: Json;
  notes: string | null;
}

type Validated =
  | { ok: false; state: FormState }
  | { ok: true; fields: RunFields; defects: DefectRow[]; completedAt: string | null };

/**
 * Everything a create and an edit have in common: parse, check ownership and
 * domain, validate parameters and defects against the SERVER's dictionary,
 * and derive units_good from the outcome. Nothing is written here.
 */
async function validateRun(supabase: ServerClient, formData: FormData): Promise<Validated> {
  const fields = formObject(formData);

  const parsed = runSchema.safeParse(fields);
  const errors: FieldErrors = parsed.success ? {} : fieldErrorsFrom(parsed.error);

  const duration = parseDurationMinutes(fields.duration);
  if (!duration.ok) errors.duration = duration.message;

  // Weighed on a scale is the only way a quantity counts as measured. Slicer
  // grams typed by hand are still a slicer estimate.
  const weighed = formData.get('weighed') === 'on';

  let completedAt: string | null = null;
  const completedRaw = (fields.completed_at_iso ?? '').trim();
  if (completedRaw !== '') {
    const d = new Date(completedRaw);
    if (Number.isNaN(d.getTime())) errors.completed_at = 'That date and time is not valid.';
    else completedAt = d.toISOString();
  }

  if (!parsed.success) return { ok: false, state: errorState('Check the highlighted fields.', errors) };
  const v = parsed.data;

  // Ownership and domain. RLS hides other users' rows, so "not found" covers
  // both a deleted row and a forged id. Foreign keys alone would not catch a
  // forged id: FK checks are not filtered by RLS. Archived rows still count as
  // owned, so editing an old run on an archived machine keeps its machine.
  const [machineRes, materialRes, projectRes] = await Promise.all([
    v.machine_id
      ? supabase.from('machines').select('id, domain_id').eq('id', v.machine_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    v.material_id
      ? supabase.from('materials').select('id, domain_id').eq('id', v.material_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    v.project_id
      ? supabase.from('projects').select('id').eq('id', v.project_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (v.machine_id && !machineRes.data) errors.machine_id = 'That machine is no longer available.';
  if (v.material_id && !materialRes.data) errors.material_id = 'That material is no longer available.';
  if (v.project_id && !projectRes.data) errors.project_id = 'That project is no longer available.';

  // The machine decides the process. A material from a different process is a
  // mistake worth stopping: its parameters and defects would not match.
  const domainId = machineRes.data?.domain_id ?? materialRes.data?.domain_id ?? v.domain_id;
  if (materialRes.data && materialRes.data.domain_id !== domainId) {
    errors.material_id = 'That material belongs to a different process than the machine.';
  }

  const [defsRes, defectsRes] = await Promise.all([
    supabase
      .from('parameter_defs')
      .select('key, display_name, group_name, data_type, unit, min_value, max_value, step, enum_options, is_required, help_text, sort_order, domain_id')
      .eq('domain_id', domainId)
      .eq('is_active', true),
    supabase.from('defect_types').select('id').eq('domain_id', domainId).eq('is_active', true),
  ]);
  if (defsRes.error || defectsRes.error) {
    return { ok: false, state: errorState('Could not load the settings dictionary. Try again.', errors) };
  }

  const params = parseParameterFields(fields, defsRes.data);
  Object.assign(errors, params.errors);

  const allowedDefects = new Set(defectsRes.data.map((d) => d.id));
  const defects: DefectRow[] = [];
  for (const raw of formData.getAll('defect')) {
    const id = Number(raw);
    if (!allowedDefects.has(id)) {
      errors.defects = 'One of the selected defects is not valid for this process. Reload and try again.';
      continue;
    }
    const sevRaw = String(formData.get(`severity.${id}`) ?? '').trim();
    const sev = sevRaw === '' ? null : Number(sevRaw);
    if (sev !== null && !(Number.isInteger(sev) && sev >= 1 && sev <= 5)) {
      errors.defects = 'Severity must be between 1 and 5.';
      continue;
    }
    defects.push({ defect_type_id: id, severity: sev });
  }

  // Good parts follow from the outcome. Stored explicitly so Phase 2 never has
  // to guess: a failed plate has zero usable parts, not "unknown".
  const unitsProduced = v.units_produced ?? 1;
  let unitsGood = 0;
  if (v.outcome === 'success') {
    unitsGood = unitsProduced;
  } else if (v.outcome === 'partial') {
    if (v.units_good === null) errors.units_good = 'How many parts are usable? 0 is allowed.';
    else if (v.units_good > unitsProduced) errors.units_good = `Cannot be more than the ${unitsProduced} on the plate.`;
    else unitsGood = v.units_good;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, state: errorState('Check the highlighted fields.', errors) };
  }

  return {
    ok: true,
    completedAt,
    defects,
    fields: {
      domain_id: domainId,
      machine_id: v.machine_id,
      material_id: v.material_id,
      project_id: v.project_id,
      title: v.title,
      duration_minutes: duration.ok ? duration.minutes : null,
      material_qty_used: v.material_qty_used,
      material_qty_estimated: v.material_qty_used !== null && !weighed,
      active_labor_minutes: v.active_labor_minutes ?? 0,
      units_produced: unitsProduced,
      units_good: unitsGood,
      outcome: v.outcome,
      quality_rating: v.quality_rating,
      parameters: params.values as Json,
      notes: v.notes,
    },
  };
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

export async function saveRun(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const result = await validateRun(supabase, formData);
  if (!result.ok) return result.state;

  // Where the numbers came from. For an import, source_metadata keeps the
  // parser's raw matches as evidence, so a future parser fix can re-read old
  // runs and a wrong value can be traced to the line that produced it.
  const source = formData.get('source') === 'gcode_import' ? 'gcode_import' : 'manual';
  let sourceMetadata: Json = {};
  if (source === 'gcode_import') {
    const rawMeta = String(formData.get('source_metadata') ?? '');
    let ok = rawMeta.length > 0 && rawMeta.length <= 20_000;
    if (ok) {
      try {
        const obj: unknown = JSON.parse(rawMeta);
        ok = obj !== null && typeof obj === 'object' && !Array.isArray(obj);
        if (ok) sourceMetadata = obj as Json;
      } catch {
        ok = false;
      }
    }
    if (!ok) return errorState('The imported file data was damaged. Import the file again.');
  }

  const { data: inserted, error: insertError } = await supabase
    .from('runs')
    .insert({
      ...result.fields,
      user_id: userId,
      completed_at: result.completedAt ?? new Date().toISOString(),
      source,
      source_metadata: sourceMetadata,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    return errorState(insertError ? dbErrorMessage(insertError, 'run') : 'The run did not save.');
  }

  if (result.defects.length > 0) {
    const { error: defectError } = await supabase
      .from('run_defects')
      .insert(result.defects.map((d) => ({ ...d, run_id: inserted.id })));
    if (defectError) {
      // No transaction across two PostgREST calls, so undo by hand: a run
      // saved without the defects you ticked is a wrong record, and a wrong
      // record is worse than asking you to press save again.
      await supabase.from('runs').delete().eq('id', inserted.id);
      return errorState(`The defects did not save, so the run was not saved either. ${defectError.message}`);
    }
  }

  revalidatePath('/app/runs');
  revalidatePath('/app');
  redirect('/app/runs?notice=saved');
}

// ---------------------------------------------------------------------------
// edit
// ---------------------------------------------------------------------------

/**
 * Bound with the run id on the server page. Source and source_metadata are
 * never touched: an imported run stays an import, with its evidence, after
 * a correction. A blank finish time keeps the existing one.
 */
export async function updateRun(runId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  if (!UUID.test(runId)) return errorState('That run no longer exists.');

  const result = await validateRun(supabase, formData);
  if (!result.ok) return result.state;

  const { data: updated, error: updateError } = await supabase
    .from('runs')
    .update({ ...result.fields, ...(result.completedAt ? { completed_at: result.completedAt } : {}) })
    .eq('id', runId)
    .select('id');
  if (updateError) return errorState(dbErrorMessage(updateError, 'run'));
  // PostgREST answers 200 for an update that matched nothing, which is what
  // RLS produces for a run that is not yours.
  if (!updated || updated.length === 0) return errorState('That run no longer exists.');

  // Defects: upsert the ticked set, then delete the unticked. Upsert first so
  // a failure part-way leaves extra defects, never lost ones.
  if (result.defects.length > 0) {
    const { error } = await supabase
      .from('run_defects')
      .upsert(
        result.defects.map((d) => ({ ...d, run_id: runId })),
        { onConflict: 'run_id,defect_type_id' },
      );
    if (error) {
      return errorState(`The run saved but its defects did not. Open it and save again. ${error.message}`);
    }
  }
  let removal = supabase.from('run_defects').delete().eq('run_id', runId);
  if (result.defects.length > 0) {
    removal = removal.not('defect_type_id', 'in', `(${result.defects.map((d) => d.defect_type_id).join(',')})`);
  }
  const { error: removeError } = await removal;
  if (removeError) {
    return errorState(`The run saved but an unticked defect was not removed. Save again. ${removeError.message}`);
  }

  revalidatePath('/app/runs');
  revalidatePath(`/app/runs/${runId}`);
  revalidatePath('/app');
  redirect(`/app/runs/${runId}?notice=saved`);
}

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------

/** Defects go with it (ON DELETE CASCADE). Nothing else references a run. */
export async function deleteRun(runId: string): Promise<void> {
  const { supabase } = await requireUser();
  if (!UUID.test(runId)) redirect('/app/runs');

  const { data, error } = await supabase.from('runs').delete().eq('id', runId).select('id');
  if (error || !data || data.length === 0) {
    redirect(`/app/runs/${runId}?notice=delete_failed`);
  }

  revalidatePath('/app/runs');
  revalidatePath('/app');
  redirect('/app/runs?notice=deleted');
}
