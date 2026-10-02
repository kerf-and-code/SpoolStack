'use server';

// The "Did it print?" inbox: turning a file the slicer uploader sent into a
// run with one tap, or setting it aside.
//
// One tap is only offered when nothing has to be guessed: the file's printer
// matches exactly one of your machines and its filament exactly one of your
// materials. Anything less opens the full form, because a run on the wrong
// machine or spool is a wrong cost forever.

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import type { Json } from '@/lib/database.types';
import { titleFromFileName } from '@/lib/gcode-file';
import { acceptImportedParameters, importMetadata, storedParse } from '@/lib/import-record';
import type { ServerClient } from '@/lib/supabase/server';
import { resolveSetup } from '@/lib/inbox-match';
import { PARAM_DEF_COLUMNS } from './runs/data';

const UUID = /^[0-9a-f-]{36}$/i;

export type InboxResult =
  | { ok: true; runId: string; title: string }
  | { ok: false; message: string; openForm?: boolean };

async function loadSetup(supabase: ServerClient) {
  const [machines, materials] = await Promise.all([
    supabase.from('machines').select('id, name, make, model, domain_id').eq('is_active', true),
    supabase.from('materials').select('id, name, category, brand, domain_id').eq('is_active', true),
  ]);
  return { machines: machines.data ?? [], materials: materials.data ?? [] };
}

export async function logPendingWorked(pendingId: string): Promise<InboxResult> {
  const { supabase, userId } = await requireUser();
  if (typeof pendingId !== 'string' || !UUID.test(pendingId)) {
    return { ok: false, message: 'That entry is not valid. Reload the page.' };
  }

  const { data: pending } = await supabase
    .from('pending_runs')
    .select('id, file_name, parsed, slicer_config, status')
    .eq('id', pendingId)
    .maybeSingle();
  if (!pending) return { ok: false, message: 'That entry no longer exists. Reload the page.' };
  if (pending.status !== 'pending') return { ok: false, message: 'Already logged or set aside. Reload the page.' };

  const parsed = storedParse(pending.parsed);
  const { machines, materials } = await loadSetup(supabase);
  const { machine, material } = resolveSetup(
    parsed.printerModel,
    parsed.filamentType,
    parsed.filamentBrand,
    machines,
    materials,
  );
  if (!machine || !material) {
    return { ok: false, openForm: true, message: 'Pick the machine and material for this one.' };
  }

  const { data: defs, error: defsError } = await supabase
    .from('parameter_defs')
    .select(PARAM_DEF_COLUMNS)
    .eq('domain_id', machine.domain_id)
    .eq('is_active', true);
  if (defsError) return { ok: false, message: 'Could not load the settings dictionary. Try again.' };

  const { accepted, validation } = acceptImportedParameters(parsed.parameters, defs ?? []);
  const fileName = pending.file_name;
  const title = titleFromFileName(fileName) || null;
  const metadata = importMetadata(
    parsed,
    { format: parsed.config_format, skipped: parsed.config_skipped },
    { fileName, kind: 'gcode', plate: null, notes: parsed.warnings, pendingId: pending.id },
    validation,
  );

  const { data: run, error: insertError } = await supabase
    .from('runs')
    .insert({
      user_id: userId,
      domain_id: machine.domain_id,
      machine_id: machine.id,
      material_id: material.id,
      title,
      duration_minutes: parsed.durationMinutes,
      material_qty_used: parsed.materialQtyUsedG,
      // A slicer's grams are an estimate until someone weighs the part.
      material_qty_estimated: parsed.materialQtyUsedG !== null,
      units_produced: 1,
      units_good: 1,
      outcome: 'success',
      parameters: accepted as Json,
      source: 'gcode_import',
      source_metadata: metadata as Json,
      slicer_config: pending.slicer_config,
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (insertError || !run) {
    return { ok: false, message: insertError ? `The run did not save. ${insertError.message}` : 'The run did not save.' };
  }

  const { error: closeError } = await supabase
    .from('pending_runs')
    .update({ status: 'logged', run_id: run.id, resolved_at: new Date().toISOString() })
    .eq('id', pending.id)
    .eq('status', 'pending');
  if (closeError) console.error('pending run not closed', pending.id, closeError.message);

  revalidatePath('/app');
  revalidatePath('/app/runs');
  return { ok: true, runId: run.id, title: title ?? fileName };
}

export async function dismissPending(pendingId: string): Promise<{ ok: boolean; message?: string }> {
  const { supabase } = await requireUser();
  if (typeof pendingId !== 'string' || !UUID.test(pendingId)) return { ok: false, message: 'Reload the page.' };
  const { data, error } = await supabase
    .from('pending_runs')
    .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
    .eq('id', pendingId)
    .eq('status', 'pending')
    .select('id');
  if (error) return { ok: false, message: error.message };
  if (!data || data.length === 0) return { ok: false, message: 'Already logged or set aside. Reload the page.' };
  revalidatePath('/app');
  return { ok: true };
}
