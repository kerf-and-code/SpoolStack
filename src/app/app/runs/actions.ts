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

export async function saveRun(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, userId } = await requireUser();
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

  // Where the numbers came from. For an import, source_metadata keeps the
  // parser's raw matches as evidence, so a future parser fix can re-read old
  // runs and a wrong value can be traced to the line that produced it.
  const source = fields.source === 'gcode_import' ? 'gcode_import' : 'manual';
  let sourceMetadata: Json = {};
  if (source === 'gcode_import') {
    const rawMeta = fields.source_metadata ?? '';
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
    if (!ok) return errorState('The imported file data was damaged. Import the file again.', errors);
  }

  if (!parsed.success) {
    return errorState('Check the highlighted fields.', errors);
  }
  const v = parsed.data;

  // Ownership and domain. RLS hides other users' rows, so "not found" covers
  // both a deleted row and a forged id. Foreign keys alone would not catch a
  // forged id: FK checks are not filtered by RLS.
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

  // Parameters and defects are validated against the SERVER's copy of the
  // dictionary for this domain, never against what the browser rendered.
  const [defsRes, defectsRes] = await Promise.all([
    supabase
      .from('parameter_defs')
      .select('key, display_name, group_name, data_type, unit, min_value, max_value, step, enum_options, is_required, help_text, sort_order, domain_id')
      .eq('domain_id', domainId)
      .eq('is_active', true),
    supabase.from('defect_types').select('id').eq('domain_id', domainId).eq('is_active', true),
  ]);
  if (defsRes.error || defectsRes.error) {
    return errorState('Could not load the settings dictionary. Try again.', errors);
  }

  const params = parseParameterFields(fields, defsRes.data);
  Object.assign(errors, params.errors);

  const allowedDefects = new Set(defectsRes.data.map((d) => d.id));
  const defectRows: { defect_type_id: number; severity: number | null }[] = [];
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
    defectRows.push({ defect_type_id: id, severity: sev });
  }

  // Good parts follow from the outcome. Stored explicitly so Phase 2 never has
  // to guess: a failed plate has zero usable parts, not "unknown".
  const unitsProduced = v.units_produced ?? 1;
  let unitsGood: number;
  if (v.outcome === 'success') {
    unitsGood = unitsProduced;
  } else if (v.outcome === 'partial') {
    if (v.units_good === null) {
      errors.units_good = 'How many parts are usable? 0 is allowed.';
      unitsGood = 0;
    } else if (v.units_good > unitsProduced) {
      errors.units_good = `Cannot be more than the ${unitsProduced} on the plate.`;
      unitsGood = 0;
    } else {
      unitsGood = v.units_good;
    }
  } else {
    unitsGood = 0;
  }

  if (Object.keys(errors).length > 0) {
    return errorState('Check the highlighted fields.', errors);
  }

  const { data: inserted, error: insertError } = await supabase
    .from('runs')
    .insert({
      user_id: userId,
      domain_id: domainId,
      machine_id: v.machine_id,
      material_id: v.material_id,
      project_id: v.project_id,
      title: v.title,
      completed_at: completedAt ?? new Date().toISOString(),
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
      source,
      source_metadata: sourceMetadata,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    return errorState(insertError ? dbErrorMessage(insertError, 'run') : 'The run did not save.');
  }

  if (defectRows.length > 0) {
    const { error: defectError } = await supabase
      .from('run_defects')
      .insert(defectRows.map((d) => ({ ...d, run_id: inserted.id })));
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
