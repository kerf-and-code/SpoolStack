// import-record.ts
// Turning a parsed slicer file into run values, shared by the three ways a
// file arrives: picked in the run form, sent by the slicer uploader and
// opened from the inbox, and logged in one tap from the inbox. Keeping one
// copy means all three store the same record for the same file.

import { validateParameters, type ParameterDef, type ParsedRun, type ValidationResult } from './gcodeParse.ts';

export interface ImportDef {
  key: string;
  display_name: string;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  data_type: string;
  enum_options: string[] | null;
  domain_id: string;
}

export interface OutOfRange {
  label: string;
  value: number;
  range: string;
}

/**
 * Gcode is FDM. Validate against the FDM dictionary, and drop anything
 * clamped: an out-of-range value from a file is shown, not stored.
 */
export function acceptImportedParameters(
  parameters: ParsedRun['parameters'],
  defs: ImportDef[],
): { accepted: Record<string, number | string | boolean>; outOfRange: OutOfRange[]; validation: ValidationResult } {
  const fdmDefs = defs.filter((d) => d.domain_id === 'fdm');
  const validation = validateParameters(parameters ?? {}, fdmDefs as unknown as ParameterDef[]);
  const accepted = { ...validation.accepted };
  const outOfRange: OutOfRange[] = [];
  for (const [key, [original]] of Object.entries(validation.clamped)) {
    delete accepted[key];
    const def = fdmDefs.find((d) => d.key === key);
    outOfRange.push({
      label: def?.display_name ?? key,
      value: original,
      range: def ? `${def.min_value} to ${def.max_value}${def.unit ? ` ${def.unit}` : ''}` : 'a different range',
    });
  }
  return { accepted, outOfRange, validation };
}

export interface ImportOrigin {
  fileName: string;
  kind: 'gcode' | '3mf';
  plate: string | null;
  notes: string[];
  /** Set when the file came from the slicer uploader. */
  pendingId?: string;
}

/** What runs.source_metadata keeps for an imported run: the evidence trail. */
export function importMetadata(
  parsed: ParsedRun,
  config: { format: string | null; skipped: number },
  origin: ImportOrigin,
  validation: ValidationResult,
): Record<string, unknown> {
  return {
    parser_version: 2,
    ...(origin.pendingId ? { via: 'slicer_uploader', pending_id: origin.pendingId } : {}),
    file_name: origin.fileName,
    file_kind: origin.kind,
    plate: origin.plate,
    slicer: parsed.slicer,
    printer_model: parsed.printerModel,
    filament_type: parsed.filamentType,
    filament_brand: parsed.filamentBrand,
    material_source: parsed.materialSource,
    config_format: config.format,
    config_skipped: config.skipped,
    raw: parsed.raw,
    notes: origin.notes,
    clamped: validation.clamped,
    rejected: validation.rejected,
  };
}

/**
 * A ParsedRun read back from pending_runs.parsed. Fields that are missing
 * or the wrong type become null or empty, so an old or damaged row can still
 * be opened in the form instead of throwing.
 */
export function storedParse(v: unknown): ParsedRun & { config_format: string | null; config_skipped: number } {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const str = (x: unknown) => (typeof x === 'string' && x !== '' ? x : null);
  const obj = (x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, never>) : {});
  const source = o.materialSource;
  return {
    durationMinutes: num(o.durationMinutes),
    materialQtyUsedG: num(o.materialQtyUsedG),
    materialEstimated: o.materialEstimated === true,
    materialSource:
      source === 'stated_grams' || source === 'from_volume' || source === 'from_length' ? source : null,
    filamentType: str(o.filamentType),
    printerModel: str(o.printerModel),
    filamentBrand: str(o.filamentBrand),
    slicer: str(o.slicer),
    parameters: obj(o.parameters),
    raw: obj(o.raw),
    warnings: Array.isArray(o.warnings) ? o.warnings.filter((w): w is string => typeof w === 'string') : [],
    config_format: str(o.config_format),
    config_skipped: num(o.config_skipped) ?? 0,
  };
}
