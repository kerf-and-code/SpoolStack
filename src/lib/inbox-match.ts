// Which machine and material a file from the slicer uploader would be
// logged against. Shared by the dashboard, to decide whether to offer one
// tap, and the inbox action, which decides again on fresh data before
// writing. Null means "not certain": the form asks instead.

import { matchMachines, matchMaterial } from './import-match.ts';

export interface MachineRow {
  id: string;
  name: string;
  make: string | null;
  model: string | null;
  domain_id: string;
}
export interface MaterialRow {
  id: string;
  name: string;
  category: string | null;
  brand: string | null;
  domain_id: string;
}

/**
 * The machine and material a file would be logged against, or null where it
 * is not certain. Shared by the dashboard (to decide whether to offer one
 * tap) and the action (to decide again, on fresh data, before writing).
 */
export function resolveSetup(
  printerModel: string | null,
  filamentType: string | null,
  filamentBrand: string | null,
  machines: MachineRow[],
  materials: MaterialRow[],
): { machine: MachineRow | null; material: MaterialRow | null } {
  let machine: MachineRow | null = null;
  if (printerModel) {
    const matches = matchMachines(printerModel, machines);
    if (matches.length === 1) machine = matches[0];
  } else if (machines.length === 1) {
    machine = machines[0];
  }

  let material: MaterialRow | null = null;
  const sameDomain = materials.filter((m) => !machine || m.domain_id === machine.domain_id);
  if (filamentType) {
    const m = matchMaterial(filamentType, filamentBrand, sameDomain, '');
    if (m.kind === 'select') material = m.material;
  } else if (sameDomain.length === 1) {
    material = sameDomain[0];
  }
  return { machine, material };
}

/** How far back the inbox looks. Older pending files are kept, just not shown. */
export const INBOX_DAYS = 14;

export function inboxCutoffIso(now: number = Date.now()): string {
  return new Date(now - INBOX_DAYS * 24 * 3600 * 1000).toISOString();
}
