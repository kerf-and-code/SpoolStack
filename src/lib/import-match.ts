// Match what a gcode file says (printer model, filament type and brand) to
// the user's own machines and materials.
//
// The rule throughout: auto-select only when exactly one thing matches.
// Picking the wrong spool silently mis-costs the run, which is worse than
// asking the user to tap a picker.

export interface MachineLike {
  id: string;
  name: string;
  make: string | null;
  model: string | null;
}

export interface MaterialLike {
  id: string;
  name: string;
  category: string | null;
  brand: string | null;
  /** "#RRGGBB". Optional so callers without colours still type-check. */
  color_hex?: string | null;
}

export function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Machines whose name, model, or make+model matches the file's printer model.
 * Short tokens (under 3 characters after normalising) never match by
 * containment, so a model of "X" does not match every printer with an x in it.
 *
 * Exact matches win over containment. Without that, someone who owns both an
 * A1 and an A1 mini gets neither auto-selected, because "Bambu Lab A1" is
 * contained in "Bambu Lab A1 mini" and the other way round.
 */
export function matchMachines<T extends MachineLike>(printerModel: string | null, machines: T[]): T[] {
  const target = norm(printerModel);
  if (target.length < 2) return [];
  const candidatesOf = (m: T) =>
    [m.name, m.model, [m.make, m.model].filter(Boolean).join(' ')].map(norm).filter(Boolean);
  const exact = machines.filter((m) => candidatesOf(m).some((c) => c === target));
  if (exact.length > 0) return exact;
  return machines.filter((m) =>
    candidatesOf(m).some((c) => (c.length >= 3 && target.includes(c)) || (target.length >= 3 && c.includes(target))),
  );
}

export type MaterialMatch<T> =
  | { kind: 'keep'; material: T }
  | { kind: 'select'; material: T }
  | { kind: 'ambiguous'; candidates: T[] }
  | { kind: 'none' };

/**
 * Pick a material for the file's filament type. Keeps the current selection if
 * it already matches, so importing never overrides a deliberate choice.
 *
 * With the file's colour (filament_colour, "#RRGGBB"):
 *   - two spools of the same type are told apart by colour;
 *   - a spool of the SAME brand recorded in a DIFFERENT colour is ruled out,
 *     so last run's Bambu black is not picked for a Bambu maroon print.
 * A different brand's colour is never used to rule anything out: slicer
 * profiles for other brands often carry a made-up display colour.
 */
export function matchMaterial<T extends MaterialLike>(
  filamentType: string | null,
  filamentBrand: string | null,
  materials: T[],
  currentId: string,
  fileHex: string | null = null,
): MaterialMatch<T> {
  const type = norm(filamentType);
  if (!type) return { kind: 'none' };

  const brand = norm(filamentBrand);
  const hex = fileHex ? fileHex.toUpperCase() : null;
  const brandMatches = (m: T) => {
    const b = norm(m.brand);
    return brand !== '' && b.length >= 3 && brand.includes(b);
  };
  const contradicts = (m: T) =>
    hex !== null && !!m.color_hex && m.color_hex.toUpperCase() !== hex && brandMatches(m);

  const byType = materials.filter((m) => norm(m.category) === type && !contradicts(m));
  if (byType.length === 0) return { kind: 'none' };

  const current = byType.find((m) => m.id === currentId);
  if (current) return { kind: 'keep', material: current };

  if (byType.length === 1) return { kind: 'select', material: byType[0] };

  // Narrow by brand, then by colour; stop at the first step that leaves one.
  let candidates = byType;
  const byBrand = candidates.filter(brandMatches);
  if (byBrand.length === 1) return { kind: 'select', material: byBrand[0] };
  if (byBrand.length > 1) candidates = byBrand;
  if (hex) {
    const byColour = candidates.filter((m) => m.color_hex && m.color_hex.toUpperCase() === hex);
    if (byColour.length === 1) return { kind: 'select', material: byColour[0] };
  }

  return { kind: 'ambiguous', candidates };
}
