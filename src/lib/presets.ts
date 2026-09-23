// Starting points for the "Add machine" and "Add material" forms.
//
// The rule for what goes in here, agreed in M1: physical specs only.
//   * Never prices. What someone paid is theirs to enter; a preset price would
//     be wrong for most people and silently skew every costed run.
//   * Never power draw. Nameplate wattage overstates real average draw badly,
//     and the costing form says so. A plug-in meter gives the real figure.
//   * A value is filled only when a source stated it. Where the source did not
//     give the stock nozzle size, nozzle_diameter_mm is null and the form shows
//     its placeholder instead of a guess.
//
// Machine make and model are spelled the way slicers write printer_model into
// gcode (for example "Bambu Lab A1", "Creality K1C", PrusaSlicer's "MK4S"), so
// a machine added from a preset is matched automatically on import.
//
// Sources, checked 2026-09-23:
//   Bambu Lab A1         bambulab.com/en/a1/tech-specs
//   Bambu Lab A1 mini    Bambu Lab spec sheet PDF (store.bblcdn.com)
//   Bambu Lab P1S        us.store.bambulab.com/products/p1s
//   Bambu Lab P2S        goodprints3d.com, quoting Bambu's P2S spec page
//   Bambu Lab X1 Carbon  3dpros.com
//   Bambu Lab H2D        matterhackers.com (single-nozzle volume)
//   Prusa MK4S           prusa3d.com product page
//   Prusa CORE One       3dprintingindustry.com launch specs
//   Prusa MINI+          3dpros.com, en.wikipedia.org
//   Prusa XL             prusa3d.com product page
//   Creality K1C         creality.com product page
//   Creality K2 Plus     store.creality.com product page
//   Creality Ender-3 V3 SE  simplyprint.io spec table
//   Elegoo Centauri Carbon  Elegoo introduction PDF
//   Elegoo Neptune 4 Pro    us.elegoo.com product page
//   Anycubic Kobra 3     store.anycubic.com product page
//   QIDI Q1 Pro          us.qidi3d.com product page
//   Sovol SV06           clevercreations.org spec table
//
// Filament densities are the slicer defaults already used by the gcode
// importer (MATERIAL_DENSITY_G_CM3), so a preset material and an import agree.
// Adding a preset is a data change here; no schema change is involved.

import { MATERIAL_DENSITY_G_CM3 } from './gcodeParse.ts';

export interface MachinePreset {
  id: string;
  make: string;
  model: string;
  domain_id: 'fdm';
  build_volume: string;
  nozzle_diameter_mm: number | null;
}

export interface MaterialPreset {
  id: string;
  label: string;
  name: string;
  category: string;
  domain_id: 'fdm';
  unit: 'g';
  density_g_cm3: number;
  diameter_mm: number;
}

export const MACHINE_PRESETS: readonly MachinePreset[] = [
  { id: 'bambu-a1', make: 'Bambu Lab', model: 'A1', domain_id: 'fdm', build_volume: '256 x 256 x 256 mm', nozzle_diameter_mm: 0.4 },
  { id: 'bambu-a1-mini', make: 'Bambu Lab', model: 'A1 mini', domain_id: 'fdm', build_volume: '180 x 180 x 180 mm', nozzle_diameter_mm: 0.4 },
  { id: 'bambu-p1s', make: 'Bambu Lab', model: 'P1S', domain_id: 'fdm', build_volume: '256 x 256 x 256 mm', nozzle_diameter_mm: 0.4 },
  { id: 'bambu-p2s', make: 'Bambu Lab', model: 'P2S', domain_id: 'fdm', build_volume: '256 x 256 x 256 mm', nozzle_diameter_mm: null },
  { id: 'bambu-x1c', make: 'Bambu Lab', model: 'X1 Carbon', domain_id: 'fdm', build_volume: '256 x 256 x 256 mm', nozzle_diameter_mm: 0.4 },
  { id: 'bambu-h2d', make: 'Bambu Lab', model: 'H2D', domain_id: 'fdm', build_volume: '325 x 320 x 325 mm (one nozzle)', nozzle_diameter_mm: 0.4 },
  { id: 'prusa-mk4s', make: 'Prusa Research', model: 'MK4S', domain_id: 'fdm', build_volume: '250 x 210 x 220 mm', nozzle_diameter_mm: 0.4 },
  { id: 'prusa-core-one', make: 'Prusa Research', model: 'CORE One', domain_id: 'fdm', build_volume: '250 x 220 x 270 mm', nozzle_diameter_mm: 0.4 },
  { id: 'prusa-mini-plus', make: 'Prusa Research', model: 'MINI+', domain_id: 'fdm', build_volume: '180 x 180 x 180 mm', nozzle_diameter_mm: null },
  { id: 'prusa-xl', make: 'Prusa Research', model: 'XL', domain_id: 'fdm', build_volume: '360 x 360 x 360 mm', nozzle_diameter_mm: null },
  { id: 'creality-k1c', make: 'Creality', model: 'K1C', domain_id: 'fdm', build_volume: '220 x 220 x 250 mm', nozzle_diameter_mm: 0.4 },
  { id: 'creality-k2-plus', make: 'Creality', model: 'K2 Plus', domain_id: 'fdm', build_volume: '350 x 350 x 350 mm', nozzle_diameter_mm: null },
  { id: 'creality-ender-3-v3-se', make: 'Creality', model: 'Ender-3 V3 SE', domain_id: 'fdm', build_volume: '220 x 220 x 250 mm', nozzle_diameter_mm: null },
  { id: 'elegoo-centauri-carbon', make: 'Elegoo', model: 'Centauri Carbon', domain_id: 'fdm', build_volume: '256 x 256 x 256 mm', nozzle_diameter_mm: 0.4 },
  { id: 'elegoo-neptune-4-pro', make: 'Elegoo', model: 'Neptune 4 Pro', domain_id: 'fdm', build_volume: '225 x 225 x 265 mm', nozzle_diameter_mm: null },
  { id: 'anycubic-kobra-3', make: 'Anycubic', model: 'Kobra 3', domain_id: 'fdm', build_volume: '250 x 250 x 260 mm', nozzle_diameter_mm: 0.4 },
  { id: 'qidi-q1-pro', make: 'QIDI', model: 'Q1 Pro', domain_id: 'fdm', build_volume: '245 x 245 x 240 mm', nozzle_diameter_mm: 0.4 },
  { id: 'sovol-sv06', make: 'Sovol', model: 'SV06', domain_id: 'fdm', build_volume: '220 x 220 x 250 mm', nozzle_diameter_mm: 0.4 },
];

/** Category key (as the importer spells it) and the label shown in the picker. */
const FILAMENT_TYPES: readonly { id: string; category: string; label: string }[] = [
  { id: 'generic-pla', category: 'PLA', label: 'PLA' },
  { id: 'generic-pla-plus', category: 'PLA+', label: 'PLA+' },
  { id: 'generic-petg', category: 'PETG', label: 'PETG' },
  { id: 'generic-abs', category: 'ABS', label: 'ABS' },
  { id: 'generic-asa', category: 'ASA', label: 'ASA' },
  { id: 'generic-tpu', category: 'TPU', label: 'TPU' },
  { id: 'generic-pa', category: 'PA', label: 'Nylon (PA)' },
  { id: 'generic-pc', category: 'PC', label: 'Polycarbonate (PC)' },
  { id: 'generic-hips', category: 'HIPS', label: 'HIPS' },
  { id: 'generic-pva', category: 'PVA', label: 'PVA' },
  { id: 'generic-pp', category: 'PP', label: 'Polypropylene (PP)' },
];

export const MATERIAL_PRESETS: readonly MaterialPreset[] = FILAMENT_TYPES.flatMap(({ id, category, label }) => {
  const density = MATERIAL_DENSITY_G_CM3[category];
  if (density === undefined) return [];
  return [
    {
      id,
      label: `${label}, 1.75 mm`,
      name: `${category} 1.75`,
      category,
      domain_id: 'fdm' as const,
      unit: 'g' as const,
      density_g_cm3: density,
      diameter_mm: 1.75,
    },
  ];
});

export function findMachinePreset(id: string | undefined): MachinePreset | null {
  if (!id) return null;
  return MACHINE_PRESETS.find((p) => p.id === id) ?? null;
}

export function findMaterialPreset(id: string | undefined): MaterialPreset | null {
  if (!id) return null;
  return MATERIAL_PRESETS.find((p) => p.id === id) ?? null;
}

/** Display name for a machine preset, also used as the suggested machine name. */
export function machinePresetLabel(p: MachinePreset): string {
  return `${p.make} ${p.model}`;
}
