// gcodeParse.ts
// Client-side gcode metadata extractor for FDM slicers.
// Runs entirely in the browser: the file is read with file.text() and never uploaded.
//
// Covers PrusaSlicer, OrcaSlicer, Bambu Studio, Cura, SuperSlicer and IdeaMaker.
//
// Why this file matters more than it looks: filament trackers proved makers
// resent manual entry. If logging a run is tedious the log never fills, and
// every later feature reads the log. This is the friction killer.
//
// Known gotchas handled here, each of which silently dropped data in an
// earlier draft:
//   * Orca and Bambu write "; total estimated time: 1h 2m 3s" (colon), not
//     Prusa's "; estimated printing time (normal mode) = 1h 2m 3s" (equals).
//     Matching only the Prusa shape lost the duration on the two most popular
//     slicers of 2025-2026.
//   * Multi-extruder profiles emit comma lists: "filament used [g] = 1.2,3.4".
//     Taking the first value under-reports material on every AMS/MMU print.
//   * Cura writes almost no settings as comments, but it does write M104/M140
//     commands. Scanning the command stream recovers temperatures.
//   * Volume in cm3 plus the material's real density beats length plus an
//     assumed 1.75mm diameter. Prefer it when present.

export interface ParsedRun {
  durationMinutes: number | null;
  materialQtyUsedG: number | null;
  /** True when grams were derived from length or volume rather than stated. */
  materialEstimated: boolean;
  /** How the mass was obtained, for the "estimated" badge copy. */
  materialSource: 'stated_grams' | 'from_volume' | 'from_length' | null;
  filamentType: string | null;
  printerModel: string | null;
  filamentBrand: string | null;
  slicer: string | null;
  /** Maps onto runs.parameters. Keys match parameter_defs.key for domain 'fdm'. */
  parameters: Record<string, number | string | boolean>;
  /** Everything matched, verbatim. Store in runs.source_metadata. */
  raw: Record<string, string>;
  /** Non-fatal notes for the import UI ("duration not found in this file"). */
  warnings: string[];
}

export interface ParameterDef {
  key: string;
  data_type: 'number' | 'integer' | 'boolean' | 'text' | 'enum';
  min_value: number | null;
  max_value: number | null;
  enum_options: string[] | null;
}

const DEFAULT_DENSITY_G_CM3 = 1.24; // PLA, used only when the material has none
const DEFAULT_FILAMENT_DIA_MM = 1.75;

/** Slicer density defaults, used when the chosen material has no density on file. */
export const MATERIAL_DENSITY_G_CM3: Record<string, number> = {
  PLA: 1.24,
  'PLA+': 1.24,
  PETG: 1.27,
  ABS: 1.04,
  ASA: 1.07,
  TPU: 1.21,
  NYLON: 1.14,
  PA: 1.14,
  PC: 1.20,
  HIPS: 1.04,
  PVA: 1.23,
  PP: 0.90,
};

// ---------------------------------------------------------------------------
// low-level matchers
// ---------------------------------------------------------------------------

function firstMatch(text: string, re: RegExp): string | null {
  const m = re.exec(text);
  return m && m[1] != null ? m[1].trim() : null;
}

/** First non-null result from a list of patterns. */
function firstOf(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const v = firstMatch(text, re);
    if (v != null && v !== '') return v;
  }
  return null;
}

/**
 * A slicer setting comment: "; key = value" or ";key: value".
 * Anchored to a line start so "total filament used" never matches "filament used".
 */
function setting(key: string): RegExp {
  return new RegExp(`^;\\s*${key}\\s*[=:]\\s*(.+)$`, 'im');
}

/** "1h 2m 3s" | "11m 6s" | "45s" | "2d 3h" -> minutes */
export function hmsToMinutes(s: string | null): number | null {
  if (!s) return null;
  const d = /(\d+)\s*d/i.exec(s);
  const h = /(\d+)\s*h/i.exec(s);
  const m = /(\d+)\s*m(?!s)/i.exec(s);
  const sec = /(\d+)\s*s/i.exec(s);
  if (!d && !h && !m && !sec) return null;
  const total =
    (d ? +d[1] * 1440 : 0) +
    (h ? +h[1] * 60 : 0) +
    (m ? +m[1] : 0) +
    (sec ? +sec[1] / 60 : 0);
  return total > 0 ? round2(total) : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Sum a slicer's comma-separated per-extruder list. "1.2, 3.4" -> 4.6.
 * Single values pass straight through.
 */
function sumList(v: string | null): number | null {
  if (v == null) return null;
  const parts = v
    .split(',')
    .map((p) => parseFloat(p.trim()))
    .filter((n) => Number.isFinite(n));
  if (parts.length === 0) return null;
  return round2(parts.reduce((a, b) => a + b, 0));
}

/** Take the first value of a per-extruder list. Temperatures are not additive. */
function firstNum(v: string | null): number | null {
  if (v == null) return null;
  const n = parseFloat(v.split(',')[0].trim().replace('%', ''));
  return Number.isFinite(n) ? n : null;
}

function lengthMmToGrams(
  mm: number,
  density = DEFAULT_DENSITY_G_CM3,
  dia = DEFAULT_FILAMENT_DIA_MM,
): number {
  const r = dia / 2;
  const volumeMm3 = mm * Math.PI * r * r;
  return round2((volumeMm3 / 1000) * density);
}

function boolish(v: string | null): boolean | null {
  if (v == null) return null;
  const s = v.split(',')[0].trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes' || s === 'enabled') return true;
  if (s === '0' || s === 'false' || s === 'no' || s === 'disabled') return false;
  return null;
}

// ---------------------------------------------------------------------------
// enum normalisation
// ---------------------------------------------------------------------------

const INFILL_PATTERNS = new Set([
  'grid',
  'gyroid',
  'cubic',
  'triangles',
  'lightning',
  'honeycomb',
  'concentric',
  'rectilinear',
]);

/** Slicer spellings -> the parameter_defs enum_options for fdm.infill_pattern. */
function normaliseInfillPattern(v: string | null): string | null {
  if (!v) return null;
  const s = v.trim().toLowerCase().replace(/[\s-]/g, '');
  const alias: Record<string, string> = {
    adaptivecubic: 'cubic',
    supportcubic: 'cubic',
    '3dhoneycomb': 'honeycomb',
    honeycomb: 'honeycomb',
    monotonic: 'rectilinear',
    monotonicline: 'rectilinear',
    alignedrectilinear: 'rectilinear',
    line: 'rectilinear',
    lines: 'rectilinear',
    zigzag: 'rectilinear',
    crosshatch: 'grid',
    triangle: 'triangles',
    tri: 'triangles',
  };
  const mapped = alias[s] ?? s;
  return INFILL_PATTERNS.has(mapped) ? mapped : null;
}

// ---------------------------------------------------------------------------
// main entry point
// ---------------------------------------------------------------------------

export function parseGcode(text: string): ParsedRun {
  const raw: Record<string, string> = {};
  const params: Record<string, number | string | boolean> = {};
  const warnings: string[] = [];

  const note = (k: string, v: string | null) => {
    if (v != null && v !== '') raw[k] = v;
  };

  // ---- which slicer ------------------------------------------------------
  // Prusa/Orca write a "generated by" line; Cura writes ;Generated with.
  // Bambu Studio opens its HEADER_BLOCK with a bare "; BambuStudio 01.09.00.70".
  const slicer =
    firstOf(text, [
      /^;\s*generated by\s+(.+)$/im,
      /^;\s*(BambuStudio\s+[\d.]+)\s*$/im,
      /^;Generated with\s+(.+)$/im,
      /^;\s*SLICER[_ ]?NAME\s*[=:]\s*(.+)$/im,
    ]) ?? null;
  note('slicer', slicer);

  // ---- duration ----------------------------------------------------------
  // Order matters. Orca and Bambu emit BOTH "model printing time" and
  // "total estimated time" on one line; the total is the one that includes
  // heat-up and tool changes, so it is the honest number for costing.
  let durationMinutes: number | null = null;

  const totalEstimated = firstOf(text, [
    /total estimated time\s*[:=]\s*([^;\r\n]+)/i, // Orca / Bambu  (colon form)
    /;\s*estimated printing time[^=\r\n]*=\s*([^;\r\n]+)/i, // PrusaSlicer / SuperSlicer
    /^;\s*Print time\s*[:=]\s*([^;\r\n]+)$/im, // IdeaMaker
  ]);
  const curaSeconds = firstMatch(text, /^;TIME:\s*(\d+)/im); // Cura, seconds

  if (totalEstimated) {
    note('time', totalEstimated);
    durationMinutes = hmsToMinutes(totalEstimated);
    if (durationMinutes == null) {
      // Some builds write plain seconds after the colon.
      const asSeconds = parseFloat(totalEstimated);
      if (Number.isFinite(asSeconds)) durationMinutes = round2(asSeconds / 60);
    }
  } else if (curaSeconds) {
    note('time_seconds', curaSeconds);
    durationMinutes = round2(+curaSeconds / 60);
  }
  if (durationMinutes == null) {
    warnings.push('No print time found in this file. Enter the duration by hand.');
  }

  // ---- material used -----------------------------------------------------
  // Preference order: stated grams > volume x density > length x geometry.
  let materialQtyUsedG: number | null = null;
  let materialEstimated = false;
  let materialSource: ParsedRun['materialSource'] = null;

  const filamentType =
    firstOf(text, [
      setting('filament_type'),
      setting('filament type'),
      setting('material_type'),
      /^;\s*filament used\s*\[g\][^\r\n]*;\s*filament_type\s*=\s*([A-Za-z0-9+]+)/im,
    ])?.split(',')[0]?.trim() ?? null;
  note('filament_type', filamentType);

  // The file's own density beats the lookup table: it is the value the slicer
  // actually used for its weight estimate.
  const fileDensity = firstNum(firstOf(text, [setting('filament_density')]));
  const density =
    (fileDensity != null && fileDensity > 0 ? fileDensity : null) ||
    (filamentType && MATERIAL_DENSITY_G_CM3[filamentType.toUpperCase()]) ||
    DEFAULT_DENSITY_G_CM3;

  const diameter =
    firstNum(firstOf(text, [setting('filament_diameter')])) ?? DEFAULT_FILAMENT_DIA_MM;

  const gramsStated = sumList(
    firstOf(text, [
      /^;\s*filament used\s*\[g\]\s*=\s*([\d.,\s]+)$/im,
      /^;\s*total filament used\s*\[g\]\s*=\s*([\d.,\s]+)$/im,
      /^;\s*filament weight total\s*[=:]\s*([\d.,\s]+)$/im,
      // Bambu Studio HEADER_BLOCK: "; total filament weight [g] : 13.48"
      /^;\s*total filament weight\s*\[g\]\s*[=:]\s*([\d.,\s]+)$/im,
    ]),
  );
  // Deliberately NOT reading Bambu's "total filament volume [cm^3]" line.
  // CONFIRMED against a real Bambu Studio 2.8 export: the value is mm3 despite
  // the label (135.88 g at 1.26 g/cm3 is 107.8 cm3; the file says 107841.61).
  // Reading it would be a 1000x error. The "total filament weight [g]" and
  // "total filament length [mm]" header patterns are confirmed by the same
  // file, which has no "filament used [g]" line at all.
  const cm3Stated = sumList(
    firstOf(text, [/^;\s*(?:total )?filament used\s*\[cm3\]\s*=\s*([\d.,\s]+)$/im]),
  );
  const mmStated = sumList(
    firstOf(text, [
      /^;\s*(?:total )?filament used\s*\[mm\]\s*=\s*([\d.,\s]+)$/im,
      // Bambu Studio HEADER_BLOCK: "; total filament length [mm] : 4520.08"
      /^;\s*total filament length\s*\[mm\]\s*[=:]\s*([\d.,\s]+)$/im,
    ]),
  );
  const curaMeters = sumList(firstMatch(text, /^;Filament used:\s*([\d.,\sm]+)$/im)?.replace(/m/g, '') ?? null);

  if (gramsStated != null && gramsStated > 0) {
    note('filament_g', String(gramsStated));
    materialQtyUsedG = gramsStated;
    materialSource = 'stated_grams';
  } else if (cm3Stated != null && cm3Stated > 0) {
    note('filament_cm3', String(cm3Stated));
    materialQtyUsedG = round2(cm3Stated * density);
    materialEstimated = true;
    materialSource = 'from_volume';
  } else if (mmStated != null && mmStated > 0) {
    note('filament_mm', String(mmStated));
    materialQtyUsedG = lengthMmToGrams(mmStated, density, diameter);
    materialEstimated = true;
    materialSource = 'from_length';
  } else if (curaMeters != null && curaMeters > 0) {
    note('filament_m', String(curaMeters));
    materialQtyUsedG = lengthMmToGrams(curaMeters * 1000, density, diameter);
    materialEstimated = true;
    materialSource = 'from_length';
  } else {
    warnings.push('No filament quantity found. Weigh the part, or enter grams by hand.');
  }

  // ---- machine and filament identity ------------------------------------
  const printerModel = firstOf(text, [
    setting('printer_model'),
    setting('printer_settings_id'),
    /^;TARGET_MACHINE\.NAME:\s*(.+)$/im,
    /^;\s*machine_name\s*[=:]\s*(.+)$/im,
  ]);
  note('printer_model', printerModel);

  // Bambu quotes these ("Bambu Lab") and joins per-filament values with ';'.
  const filamentBrand =
    firstOf(text, [setting('filament_vendor'), setting('filament_settings_id')])
      ?.split(';')[0]
      ?.trim()
      .replace(/^"(.*)"$/, '$1')
      .trim() || null;
  note('filament_brand', filamentBrand);

  // ---- parameters --------------------------------------------------------
  // Every key below must exist in parameter_defs for domain 'fdm'.
  const put = (key: string, value: number | string | boolean | null) => {
    if (value == null) return;
    if (typeof value === 'number' && !Number.isFinite(value)) return;
    params[key] = value;
  };

  const nozzleFromComment = firstNum(
    firstOf(text, [setting('temperature'), setting('nozzle_temperature')]),
  );
  if (nozzleFromComment != null) {
    put('nozzle_temp', nozzleFromComment);
  } else {
    // Cura writes almost no settings as comments. Fall back to the first
    // M104/M109 in the command stream, and record that we guessed: some start
    // scripts preheat to a standby temperature first.
    const fromCommand = firstNum(firstMatch(text, /^M10[49]\s+S(\d+(?:\.\d+)?)/im));
    if (fromCommand != null) {
      put('nozzle_temp', fromCommand);
      note('nozzle_temp_source', 'M104/M109 command, not a settings comment');
    }
  }
  put(
    'first_layer_temp',
    firstNum(
      firstOf(text, [
        setting('first_layer_temperature'),
        setting('nozzle_temperature_initial_layer'),
      ]),
    ),
  );
  // Bambu and Orca write a temperature for EVERY plate type the printer
  // supports, then name the plate actually used in curr_bed_type. Taking the
  // first plate key found is right only by luck, so read the named one first.
  // Checked against a real Bambu Studio 2.8 export (A1, High Temp Plate).
  const bedType = firstOf(text, [setting('curr_bed_type')])?.replace(/"/g, '').toLowerCase() ?? '';
  const plateKey = bedType.includes('supertack')
    ? 'supertack_plate_temp'
    : bedType.includes('textured')
      ? 'textured_plate_temp'
      : bedType.includes('engineering')
        ? 'eng_plate_temp'
        : bedType.includes('high temp')
          ? 'hot_plate_temp'
          : bedType.includes('cool')
            ? 'cool_plate_temp'
            : null;
  if (bedType) note('bed_type', bedType);

  const bedFromComment = firstNum(
    firstOf(text, [
      setting('bed_temperature'),
      ...(plateKey ? [setting(plateKey)] : []),
      setting('first_layer_bed_temperature'),
      setting('hot_plate_temp'),
      setting('textured_plate_temp'),
      setting('cool_plate_temp'),
    ]),
  );
  if (bedFromComment != null) {
    put('bed_temp', bedFromComment);
  } else {
    const fromCommand = firstNum(firstMatch(text, /^M1[49]0\s+S(\d+(?:\.\d+)?)/im));
    if (fromCommand != null) {
      put('bed_temp', fromCommand);
      note('bed_temp_source', 'M140/M190 command, not a settings comment');
    }
  }
  put('chamber_temp', firstNum(firstOf(text, [setting('chamber_temperature')])));

  put(
    'layer_height',
    firstNum(firstOf(text, [setting('layer_height'), /^;Layer height:\s*([\d.]+)/im])),
  );
  put(
    'first_layer_height',
    firstNum(
      firstOf(text, [setting('first_layer_height'), setting('initial_layer_print_height')]),
    ),
  );
  put(
    'line_width',
    firstNum(firstOf(text, [setting('extrusion_width'), setting('line_width')])),
  );
  put('nozzle_diameter', firstNum(firstOf(text, [setting('nozzle_diameter')])));

  put(
    'print_speed',
    firstNum(
      firstOf(text, [
        setting('outer_wall_speed'),
        setting('perimeter_speed'),
        setting('external_perimeter_speed'),
      ]),
    ),
  );
  put(
    'first_layer_speed',
    firstNum(firstOf(text, [setting('first_layer_speed'), setting('initial_layer_speed')])),
  );
  put('travel_speed', firstNum(firstOf(text, [setting('travel_speed')])));
  put(
    'acceleration',
    firstNum(
      firstOf(text, [setting('default_acceleration'), setting('outer_wall_acceleration')]),
    ),
  );

  // Prusa writes extrusion_multiplier as a ratio (0.98); Orca writes
  // filament_flow_ratio the same way. parameter_defs stores flow as a percent.
  const flowRatio = firstNum(
    firstOf(text, [setting('extrusion_multiplier'), setting('filament_flow_ratio')]),
  );
  if (flowRatio != null) put('flow_rate', round2(flowRatio <= 5 ? flowRatio * 100 : flowRatio));

  put(
    'retraction_distance',
    firstNum(firstOf(text, [setting('retract_length'), setting('retraction_length')])),
  );
  put(
    'retraction_speed',
    firstNum(firstOf(text, [setting('retract_speed'), setting('retraction_speed')])),
  );
  put('z_offset', firstNum(firstOf(text, [setting('z_offset')])));

  put(
    'infill_percent',
    firstNum(firstOf(text, [setting('fill_density'), setting('sparse_infill_density')])),
  );
  put(
    'infill_pattern',
    normaliseInfillPattern(
      firstOf(text, [setting('fill_pattern'), setting('sparse_infill_pattern')]),
    ),
  );
  put('wall_count', firstNum(firstOf(text, [setting('perimeters'), setting('wall_loops')])));
  put(
    'top_bottom_layers',
    firstNum(firstOf(text, [setting('top_solid_layers'), setting('top_shell_layers')])),
  );

  put(
    'cooling_fan_percent',
    firstNum(firstOf(text, [setting('max_fan_speed'), setting('fan_max_speed')])),
  );

  put(
    'supports',
    boolish(
      firstOf(text, [
        setting('support_material'),
        setting('enable_support'),
        setting('support_enable'),
      ]),
    ),
  );

  // Adhesion is spelled four different ways; derive one enum value.
  const brimWidth = firstNum(firstOf(text, [setting('brim_width')]));
  const brimType = firstOf(text, [setting('brim_type'), setting('adhesion_type')]);
  const raftLayers = firstNum(firstOf(text, [setting('raft_layers')]));
  if (raftLayers != null && raftLayers > 0) put('bed_adhesion', 'raft');
  else if (brimType && /raft/i.test(brimType)) put('bed_adhesion', 'raft');
  else if ((brimWidth != null && brimWidth > 0) || (brimType && /brim/i.test(brimType)))
    put('bed_adhesion', 'brim');
  else if (brimType && /skirt/i.test(brimType)) put('bed_adhesion', 'skirt');
  else if (brimType && /none/i.test(brimType)) put('bed_adhesion', 'none');

  return {
    durationMinutes,
    materialQtyUsedG,
    materialEstimated,
    materialSource,
    filamentType,
    printerModel,
    filamentBrand,
    slicer,
    parameters: params,
    raw,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// dictionary discipline
// ---------------------------------------------------------------------------

export interface ValidationResult {
  accepted: Record<string, number | string | boolean>;
  /** key -> why it was dropped, for a quiet "3 settings ignored" line in the UI. */
  rejected: Record<string, string>;
  /** key -> [parsedValue, clampedValue] where a value was pulled into range. */
  clamped: Record<string, [number, number]>;
}

/**
 * Enforce parameter_defs against a parsed bag before it reaches runs.parameters.
 * This is what keeps the flexible JSONB bag from turning into mush: a key the
 * dictionary does not define never gets written, so Phase 3 can trust that
 * every key it sees has a type, a unit and a known range.
 */
export function validateParameters(
  parsed: Record<string, number | string | boolean>,
  defs: ParameterDef[],
): ValidationResult {
  const byKey = new Map(defs.map((d) => [d.key, d]));
  const accepted: Record<string, number | string | boolean> = {};
  const rejected: Record<string, string> = {};
  const clamped: Record<string, [number, number]> = {};

  for (const [key, value] of Object.entries(parsed)) {
    const def = byKey.get(key);
    if (!def) {
      rejected[key] = 'not defined for this domain';
      continue;
    }

    if (def.data_type === 'boolean') {
      if (typeof value !== 'boolean') {
        rejected[key] = 'expected a boolean';
        continue;
      }
      accepted[key] = value;
      continue;
    }

    if (def.data_type === 'enum') {
      const opts = def.enum_options ?? [];
      if (typeof value !== 'string' || !opts.includes(value)) {
        rejected[key] = `not one of: ${opts.join(', ')}`;
        continue;
      }
      accepted[key] = value;
      continue;
    }

    if (def.data_type === 'text') {
      accepted[key] = String(value);
      continue;
    }

    // number | integer
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    if (!Number.isFinite(n)) {
      rejected[key] = 'not a number';
      continue;
    }
    let out = def.data_type === 'integer' ? Math.round(n) : n;
    if (def.min_value != null && out < def.min_value) {
      clamped[key] = [out, def.min_value];
      out = def.min_value;
    }
    if (def.max_value != null && out > def.max_value) {
      clamped[key] = [out, def.max_value];
      out = def.max_value;
    }
    accepted[key] = out;
  }

  return { accepted, rejected, clamped };
}

/**
 * Convenience wrapper for the import handler: parse, then discipline.
 *
 *   const file = input.files[0];
 *   const result = parseAndValidate(await file.text(), parameterDefs);
 *   setForm((f) => ({ ...f, ...toRunFormPatch(result) }));
 */
export function parseAndValidate(
  text: string,
  defs: ParameterDef[],
): ParsedRun & { validation: ValidationResult } {
  const parsed = parseGcode(text);
  const validation = validateParameters(parsed.parameters, defs);
  return { ...parsed, parameters: validation.accepted, validation };
}
