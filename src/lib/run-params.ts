// Run form fields <-> runs.parameters, disciplined by parameter_defs.
//
// Form inputs are named "p.<key>" so they cannot collide with the run's own
// columns. Everything that reaches runs.parameters passes through here, and
// through validateParameters() from the gcode module, so a manual entry and a
// gcode import obey exactly the same dictionary.
//
// One deliberate difference from import: an out-of-range number typed by hand
// is an ERROR, not a clamp. The importer clamps because a slicer value past a
// dictionary bound usually means the dictionary is too tight. A person who
// types 2100 meant 210, and silently storing 350 would put a wrong setting
// into the calibration history with no trace.

import type { Json, Tables } from './database.types';
import { validateParameters, type ParameterDef } from './gcodeParse.ts';

export type ParamDefRow = Pick<
  Tables<'parameter_defs'>,
  | 'key'
  | 'display_name'
  | 'group_name'
  | 'data_type'
  | 'unit'
  | 'min_value'
  | 'max_value'
  | 'step'
  | 'enum_options'
  | 'is_required'
  | 'help_text'
  | 'sort_order'
  | 'domain_id'
>;

export type ParamValue = number | string | boolean;

export const PARAM_PREFIX = 'p.';

function rangeText(def: ParamDefRow): string {
  const unit = def.unit ? ` ${def.unit}` : '';
  if (def.min_value !== null && def.max_value !== null) return `between ${def.min_value} and ${def.max_value}${unit}`;
  if (def.min_value !== null) return `at least ${def.min_value}${unit}`;
  if (def.max_value !== null) return `at most ${def.max_value}${unit}`;
  return '';
}

/**
 * Parse every "p.<key>" field against its definition. Errors are keyed by the
 * form field name ("p.nozzle_temp") so the form can show them in place.
 */
export function parseParameterFields(
  fields: Record<string, string>,
  defs: ParamDefRow[],
): { values: Record<string, ParamValue>; errors: Record<string, string> } {
  const values: Record<string, ParamValue> = {};
  const errors: Record<string, string> = {};

  for (const def of defs) {
    const name = PARAM_PREFIX + def.key;
    const raw = (fields[name] ?? '').trim();

    if (raw === '') {
      if (def.is_required) errors[name] = `${def.display_name} is required.`;
      continue;
    }

    switch (def.data_type) {
      case 'number':
      case 'integer': {
        const n = Number(raw.replace(/,/g, ''));
        if (!Number.isFinite(n)) {
          errors[name] = `${def.display_name} must be a number.`;
          break;
        }
        if (def.data_type === 'integer' && !Number.isInteger(n)) {
          errors[name] = `${def.display_name} must be a whole number.`;
          break;
        }
        if ((def.min_value !== null && n < def.min_value) || (def.max_value !== null && n > def.max_value)) {
          errors[name] = `${def.display_name} must be ${rangeText(def)}.`;
          break;
        }
        values[def.key] = n;
        break;
      }
      case 'boolean': {
        // A select with blank / yes / no, never a checkbox: an unticked box
        // cannot tell "not dried" from "did not record it", and those mean
        // opposite things to calibration.
        if (raw === 'yes') values[def.key] = true;
        else if (raw === 'no') values[def.key] = false;
        else errors[name] = `Choose yes or no for ${def.display_name}.`;
        break;
      }
      case 'enum': {
        if (!(def.enum_options ?? []).includes(raw)) {
          errors[name] = `Choose one of the listed options for ${def.display_name}.`;
          break;
        }
        values[def.key] = raw;
        break;
      }
      default: {
        if (raw.length > 200) {
          errors[name] = `${def.display_name} must be 200 characters or fewer.`;
          break;
        }
        values[def.key] = raw;
      }
    }
  }

  // Final gate: the same dictionary check gcode imports go through. By
  // construction it should accept everything above, so anything it rejects or
  // clamps is a bug in this file and must fail loudly, not be stored.
  const gate = validateParameters(values, defs as unknown as ParameterDef[]);
  for (const key of Object.keys(gate.rejected)) {
    errors[PARAM_PREFIX + key] = `${key}: ${gate.rejected[key]}.`;
  }
  for (const key of Object.keys(gate.clamped)) {
    errors[PARAM_PREFIX + key] = `${key} is outside its allowed range.`;
  }

  return { values: gate.accepted, errors };
}

/** runs.parameters back into form field strings, for "copy from last run" and editing. */
export function parametersToFields(parameters: Json | null | undefined, defs: ParamDefRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) return out;
  const bag = parameters as Record<string, Json | undefined>;
  for (const def of defs) {
    const v = bag[def.key];
    if (v === undefined || v === null) continue;
    if (typeof v === 'boolean') out[PARAM_PREFIX + def.key] = v ? 'yes' : 'no';
    else if (typeof v === 'number' || typeof v === 'string') out[PARAM_PREFIX + def.key] = String(v);
  }
  return out;
}
