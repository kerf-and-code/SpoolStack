// slicer-config.ts
// Pull EVERY named setting out of a sliced file's config block, not just the
// 21 that gcodeParse maps onto parameter_defs. Stored in runs.slicer_config.
//
// Why: Stage 4 rules and Stage 6 calibration will want settings nobody has
// mapped yet (fan curves, acceleration, seam position, pressure advance).
// A setting that was not kept on the day it was printed cannot be recovered
// later, so keep them all now and decide what matters once there is data.
//
// Formats:
//   Bambu Studio, OrcaSlicer   "; CONFIG_BLOCK_START" ... "; CONFIG_BLOCK_END"
//   PrusaSlicer, SuperSlicer   "; prusaslicer_config = begin" ... "= end"
//                              (any "<name>_config = begin" pair)
//   Cura                       settings are a JSON blob split across ";SETTING_3"
//                              lines; not read here, returns format null.
//
// Left out on purpose:
//   * Custom G-code templates (machine_start_gcode and friends). A real A1
//     export has 566 settings in 42 KB, and three of these templates are
//     22 KB of it. They are macros, not settings.
//   * Anything that could hold a credential or a path on the user's disk:
//     print host addresses, API keys, post-processing script paths.

/** Hard cap on what is stored, well under the 128 KB database check. */
export const SLICER_CONFIG_MAX_BYTES = 100_000;
const MAX_VALUE_CHARS = 1000;
const MAX_KEYS = 2000;

const SKIP_KEY =
  /(_gcode$|^gcode_|template_custom_gcode|post_process|print_?host|printhost|api_?key|apikey|password|token|secret|cafile|^thumbnails?$|_user$)/i;

export type SlicerConfigFormat = 'bambu_orca' | 'prusa';

export interface SlicerConfigResult {
  /** Setting name to value as written in the file. Null when no config block was found. */
  config: Record<string, string> | null;
  format: SlicerConfigFormat | null;
  /** Settings found but not kept (templates, credentials, oversized, over the cap). */
  skipped: number;
}

const utf8 = new TextEncoder();
const byteLength = (s: string) => utf8.encode(s).length;

function blockLines(text: string): { lines: string[]; format: SlicerConfigFormat } | null {
  const bambu = /^;\s*CONFIG_BLOCK_START\s*$([\s\S]*?)^;\s*CONFIG_BLOCK_END\s*$/m.exec(text);
  if (bambu) return { lines: bambu[1].split(/\r?\n/), format: 'bambu_orca' };

  const prusa = /^;\s*(\w+)_config\s*=\s*begin\s*$([\s\S]*?)^;\s*\1_config\s*=\s*end\s*$/im.exec(text);
  if (prusa) return { lines: prusa[2].split(/\r?\n/), format: 'prusa' };

  return null;
}

export function extractSlicerConfig(text: string): SlicerConfigResult {
  const block = blockLines(text);
  if (!block) return { config: null, format: null, skipped: 0 };

  const config: Record<string, string> = {};
  let skipped = 0;
  let bytes = 2; // the braces

  for (const line of block.lines) {
    const m = /^;\s*([A-Za-z0-9_.\-[\]]+)\s*=\s?(.*)$/.exec(line.trim());
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim();
    if (key in config) continue; // first wins, as the slicer wrote it

    if (SKIP_KEY.test(key) || value.length > MAX_VALUE_CHARS || Object.keys(config).length >= MAX_KEYS) {
      skipped++;
      continue;
    }
    // JSON adds quotes, a colon, a comma, and escapes. Measure it the way it
    // will be stored, so the cap is honest.
    const cost = byteLength(JSON.stringify(key)) + byteLength(JSON.stringify(value)) + 2;
    if (bytes + cost > SLICER_CONFIG_MAX_BYTES) {
      skipped++;
      continue;
    }
    bytes += cost;
    config[key] = value;
  }

  if (Object.keys(config).length === 0) return { config: null, format: block.format, skipped };
  return { config, format: block.format, skipped };
}

/**
 * Server-side check of a submitted config: a plain object of short strings,
 * within the size cap. Returns null for anything else, so a damaged or forged
 * field is dropped rather than stored.
 */
export function sanitizeSlicerConfig(input: unknown): Record<string, string> | null {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return null;
  const out: Record<string, string> = {};
  let bytes = 2;
  let count = 0;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value !== 'string') return null;
    if (key.length === 0 || key.length > 120 || value.length > MAX_VALUE_CHARS) return null;
    if (SKIP_KEY.test(key)) continue;
    if (++count > MAX_KEYS) return null;
    bytes += byteLength(JSON.stringify(key)) + byteLength(JSON.stringify(value)) + 2;
    if (bytes > SLICER_CONFIG_MAX_BYTES) return null;
    out[key] = value;
  }
  return count === 0 ? null : out;
}
