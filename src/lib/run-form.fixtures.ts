// A subset of the FDM parameter_defs seed from db/schema.sql, for tests.
// Values copied from the seed, not invented: if the seed changes, update here.

import type { ParamDefRow } from './run-params.ts';

const base = { domain_id: 'fdm', help_text: null, step: null, enum_options: null, is_required: false };

export const parameterDefsFixture: ParamDefRow[] = [
  { ...base, key: 'nozzle_temp', display_name: 'Nozzle temperature', group_name: 'Temperature', data_type: 'number', unit: 'C', min_value: 150, max_value: 350, is_required: true, sort_order: 10 },
  { ...base, key: 'bed_temp', display_name: 'Bed temperature', group_name: 'Temperature', data_type: 'number', unit: 'C', min_value: 0, max_value: 140, sort_order: 30 },
  { ...base, key: 'layer_height', display_name: 'Layer height', group_name: 'Quality', data_type: 'number', unit: 'mm', min_value: 0.02, max_value: 1.2, is_required: true, sort_order: 50 },
  { ...base, key: 'infill_pattern', display_name: 'Infill pattern', group_name: 'Structure', data_type: 'enum', unit: null, min_value: null, max_value: null, enum_options: ['grid', 'gyroid', 'cubic', 'triangles', 'lightning', 'honeycomb', 'concentric', 'rectilinear'], sort_order: 180 },
  { ...base, key: 'wall_count', display_name: 'Wall count', group_name: 'Structure', data_type: 'integer', unit: null, min_value: 0, max_value: 20, sort_order: 190 },
  { ...base, key: 'supports', display_name: 'Supports used', group_name: 'Adhesion', data_type: 'boolean', unit: null, min_value: null, max_value: null, sort_order: 230 },
  { ...base, key: 'filament_dried', display_name: 'Filament dried', group_name: 'Material', data_type: 'boolean', unit: null, min_value: null, max_value: null, sort_order: 250 },
];
