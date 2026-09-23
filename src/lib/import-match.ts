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
 */
export function matchMaterial<T extends MaterialLike>(
  filamentType: string | null,
  filamentBrand: string | null,
  materials: T[],
  currentId: string,
): MaterialMatch<T> {
  const type = norm(filamentType);
  if (!type) return { kind: 'none' };

  const byType = materials.filter((m) => norm(m.category) === type);
  if (byType.length === 0) return { kind: 'none' };

  const current = byType.find((m) => m.id === currentId);
  if (current) return { kind: 'keep', material: current };

  if (byType.length === 1) return { kind: 'select', material: byType[0] };

  const brand = norm(filamentBrand);
  if (brand) {
    const byBrand = byType.filter((m) => {
      const b = norm(m.brand);
      return b.length >= 3 && brand.includes(b);
    });
    if (byBrand.length === 1) return { kind: 'select', material: byBrand[0] };
  }

  return { kind: 'ambiguous', candidates: byType };
}
