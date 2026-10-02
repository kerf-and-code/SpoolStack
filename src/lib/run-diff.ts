// run-diff.ts
// What changed between a run and the run it retries. Pure, so it is tested
// on its own and used by the run page.
//
// Only settings recorded on BOTH runs, or on one of them, are compared. A
// setting missing from one side is shown as "not recorded" rather than
// skipped: "you stopped recording the bed temperature" is worth seeing too.

export interface DiffDef {
  key: string;
  display_name: string;
  unit: string | null;
  sort_order: number;
}

export interface SettingChange {
  key: string;
  label: string;
  before: string;
  after: string;
}

type Bag = Record<string, unknown>;

function asBag(v: unknown): Bag {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Bag) : {};
}

function show(v: unknown, unit: string | null): string {
  if (v === undefined || v === null || v === '') return 'not recorded';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') {
    const n = Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000);
    return unit ? `${n} ${unit}` : n;
  }
  if (typeof v === 'string') return v.replace(/_/g, ' ');
  return JSON.stringify(v);
}

function same(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Settings that differ, in dictionary order. Keys not in the dictionary come
 * last under their raw names, so nothing recorded is hidden.
 */
export function diffParameters(beforeRaw: unknown, afterRaw: unknown, defs: DiffDef[]): SettingChange[] {
  const before = asBag(beforeRaw);
  const after = asBag(afterRaw);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const byKey = new Map(defs.map((d) => [d.key, d]));

  const known: (SettingChange & { order: number })[] = [];
  const unknown: SettingChange[] = [];
  for (const key of keys) {
    if (same(before[key], after[key])) continue;
    const def = byKey.get(key);
    const change = {
      key,
      label: def?.display_name ?? key,
      before: show(before[key], def?.unit ?? null),
      after: show(after[key], def?.unit ?? null),
    };
    if (def) known.push({ ...change, order: def.sort_order });
    else unknown.push(change);
  }
  known.sort((a, b) => a.order - b.order);
  unknown.sort((a, b) => a.key.localeCompare(b.key));
  return [...known.map((c) => ({ key: c.key, label: c.label, before: c.before, after: c.after })), ...unknown];
}
