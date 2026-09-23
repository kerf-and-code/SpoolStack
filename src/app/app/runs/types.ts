// Shapes passed from the run pages (server) to the run form (client).
// Plain serialisable data only: no functions, no class instances.

import type { Json } from '@/lib/database.types';
import type { ParamDefRow } from '@/lib/run-params';

export const OUTCOMES = ['success', 'partial', 'failure', 'aborted'] as const;
export type Outcome = (typeof OUTCOMES)[number];

export interface MachineOption {
  id: string;
  name: string;
  domain_id: string;
  /** Make and model let a gcode file's printer_model find this machine. */
  make: string | null;
  model: string | null;
}

export interface MaterialOption {
  id: string;
  name: string;
  unit: string;
  domain_id: string;
  /** Category and brand let a gcode file's filament_type find this material. */
  category: string | null;
  brand: string | null;
}

export interface ProjectOption {
  id: string;
  name: string;
}

export interface DefectOption {
  id: number;
  domain_id: string;
  display_name: string;
  description: string | null;
  is_process_related: boolean;
}

/** The fields "copy from last run" can reuse. Outcome and defects are never copied. */
export interface RecentRun {
  id: string;
  title: string | null;
  created_at: string;
  machine_id: string | null;
  material_id: string | null;
  project_id: string | null;
  duration_minutes: number | null;
  material_qty_used: number | null;
  units_produced: number;
  active_labor_minutes: number;
  parameters: Json;
}

/** Prefill for editing an existing run. Built on the server from the stored row. */
export interface RunEditInitial {
  runId: string;
  /** Form field values, including "p.<key>" settings, as strings. */
  values: Record<string, string>;
  weighed: boolean;
  /** defect_type_id -> severity ('' when not recorded). */
  defects: Record<number, string>;
  completedAtIso: string | null;
}

export interface RunFormData {
  machines: MachineOption[];
  materials: MaterialOption[];
  projects: ProjectOption[];
  parameterDefs: ParamDefRow[];
  defectTypes: DefectOption[];
  recentRuns: RecentRun[];
}
