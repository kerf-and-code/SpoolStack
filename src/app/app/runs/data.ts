// Loads everything the run form needs. Shared by /new and /[id]/edit.

import type { ServerClient } from '@/lib/supabase/server';
import { OUTCOMES, type Outcome, type RetryContext, type RunFormData } from './types';

export const PARAM_DEF_COLUMNS =
  'key, display_name, group_name, data_type, unit, min_value, max_value, step, enum_options, is_required, help_text, sort_order, domain_id';

/**
 * Pickers list active rows only. When editing, pass the run's own machine,
 * material and project so an archived one stays selectable: otherwise the
 * picker would show blank and saving would silently strip it from the run.
 */
export async function loadRunFormData(
  supabase: ServerClient,
  keep: { machineId?: string | null; materialId?: string | null; projectId?: string | null } = {},
): Promise<RunFormData> {
  const machineFilter = keep.machineId ? `is_active.eq.true,id.eq.${keep.machineId}` : 'is_active.eq.true';
  const materialFilter = keep.materialId ? `is_active.eq.true,id.eq.${keep.materialId}` : 'is_active.eq.true';
  const projectFilter = keep.projectId ? `status.eq.active,id.eq.${keep.projectId}` : 'status.eq.active';

  const [machines, materials, projects, defs, defects, recent] = await Promise.all([
    supabase.from('machines').select('id, name, domain_id, make, model, is_active').or(machineFilter).order('name'),
    supabase
      .from('materials')
      .select('id, name, unit, domain_id, category, brand, is_active')
      .or(materialFilter)
      .order('name'),
    supabase.from('projects').select('id, name, status').or(projectFilter).order('name'),
    supabase.from('parameter_defs').select(PARAM_DEF_COLUMNS).eq('is_active', true).order('sort_order'),
    supabase
      .from('defect_types')
      .select('id, domain_id, display_name, description, is_process_related')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('runs')
      .select(
        'id, title, created_at, machine_id, material_id, project_id, duration_minutes, material_qty_used, units_produced, active_labor_minutes, parameters',
      )
      .order('created_at', { ascending: false })
      .limit(25),
  ]);

  const failed = [machines, materials, projects, defs, defects, recent].find((r) => r.error);
  if (failed?.error) {
    throw new Error(`Could not load the run form: ${failed.error.message}`);
  }

  return {
    machines: (machines.data ?? []).map(({ is_active, ...m }) => ({
      ...m,
      name: is_active ? m.name : `${m.name} (archived)`,
    })),
    materials: (materials.data ?? []).map(({ is_active, ...m }) => ({
      ...m,
      name: is_active ? m.name : `${m.name} (archived)`,
    })),
    projects: (projects.data ?? []).map(({ status, ...p }) => ({
      ...p,
      name: status === 'active' ? p.name : `${p.name} (archived)`,
    })),
    parameterDefs: defs.data ?? [],
    defectTypes: defects.data ?? [],
    recentRuns: recent.data ?? [],
  };
}

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * The run a retry points at, for the form's banner. With `withSource`, also
 * the fields to prefill a new retry from. Null when the id is malformed or
 * the run is not yours (RLS returns no row).
 */
export async function loadRetryContext(
  supabase: ServerClient,
  runId: string | null | undefined,
  withSource: boolean,
): Promise<RetryContext | null> {
  if (!runId || !UUID.test(runId)) return null;
  const { data: run } = await supabase
    .from('runs')
    .select(
      'id, title, outcome, created_at, completed_at, machine_id, material_id, project_id, duration_minutes, material_qty_used, units_produced, active_labor_minutes, parameters, materials(name)',
    )
    .eq('id', runId)
    .maybeSingle();
  if (!run) return null;

  const outcome: Outcome = (OUTCOMES as readonly string[]).includes(run.outcome) ? (run.outcome as Outcome) : 'failure';
  return {
    of: {
      id: run.id,
      label: run.title || run.materials?.name || 'untitled run',
      outcome,
      finishedIso: run.completed_at ?? run.created_at,
    },
    source: withSource
      ? {
          id: run.id,
          title: run.title,
          created_at: run.created_at,
          machine_id: run.machine_id,
          material_id: run.material_id,
          project_id: run.project_id,
          duration_minutes: run.duration_minutes,
          material_qty_used: run.material_qty_used,
          units_produced: run.units_produced,
          active_labor_minutes: run.active_labor_minutes,
          parameters: run.parameters,
        }
      : null,
  };
}
