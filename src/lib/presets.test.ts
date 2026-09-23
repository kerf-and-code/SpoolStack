// presets.test.ts
// Run with:  npm run test:presets
// (node --experimental-strip-types src/lib/presets.test.ts)
//
// Guards the preset rules (physical specs only, fits the form limits) and
// that a machine added from a preset is picked up by gcode import.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchMachines, matchMaterial } from './import-match.ts';
import {
  MACHINE_PRESETS,
  MATERIAL_PRESETS,
  findMachinePreset,
  findMaterialPreset,
  machinePresetLabel,
} from './presets.ts';

const MACHINE_KEYS = ['build_volume', 'domain_id', 'id', 'make', 'model', 'nozzle_diameter_mm'];
const MATERIAL_KEYS = ['category', 'density_g_cm3', 'diameter_mm', 'domain_id', 'id', 'label', 'name', 'unit'];

test('preset ids are unique', () => {
  const machineIds = MACHINE_PRESETS.map((p) => p.id);
  const materialIds = MATERIAL_PRESETS.map((p) => p.id);
  assert.equal(new Set(machineIds).size, machineIds.length);
  assert.equal(new Set(materialIds).size, materialIds.length);
});

test('machine presets carry physical specs only: no price, no wattage', () => {
  for (const p of MACHINE_PRESETS) assert.deepEqual(Object.keys(p).sort(), MACHINE_KEYS, p.id);
});

test('material presets carry physical specs only: no price', () => {
  for (const p of MATERIAL_PRESETS) assert.deepEqual(Object.keys(p).sort(), MATERIAL_KEYS, p.id);
});

test('preset values fit the form limits', () => {
  for (const p of MACHINE_PRESETS) {
    assert.ok(machinePresetLabel(p).length <= 80, `${p.id} name`);
    assert.ok(p.make.length <= 80 && p.model.length <= 80, `${p.id} make/model`);
    assert.ok(p.build_volume.length <= 60, `${p.id} build volume`);
    if (p.nozzle_diameter_mm !== null) assert.ok(p.nozzle_diameter_mm > 0 && p.nozzle_diameter_mm < 2, p.id);
  }
  for (const p of MATERIAL_PRESETS) {
    assert.ok(p.name.length <= 100 && p.category.length <= 40, p.id);
    assert.ok(p.density_g_cm3 > 0.5 && p.density_g_cm3 < 2, p.id);
  }
});

test('every filament type made it into the material presets', () => {
  assert.equal(MATERIAL_PRESETS.length, 11);
  assert.equal(findMaterialPreset('generic-petg')?.density_g_cm3, 1.27);
  assert.equal(findMaterialPreset('generic-pla-plus')?.category, 'PLA+');
});

test('lookup ignores unknown and missing ids', () => {
  assert.equal(findMachinePreset(undefined), null);
  assert.equal(findMachinePreset('not-a-printer'), null);
  assert.equal(findMaterialPreset(''), null);
  assert.equal(findMachinePreset('bambu-a1')?.model, 'A1');
});

/** A machine row as the form would save it from a preset. */
function machineFrom(id: string) {
  const p = findMachinePreset(id);
  assert.ok(p, id);
  return { id, name: machinePresetLabel(p), make: p.make, model: p.model };
}

test('a preset machine is matched by the printer_model its slicer writes', () => {
  const all = MACHINE_PRESETS.map((p) => machineFrom(p.id));
  // Strings seen in real Bambu Studio and OrcaSlicer files (see gcodeParse.test.ts).
  assert.deepEqual(matchMachines('Bambu Lab A1', all).map((m) => m.id), ['bambu-a1']);
  assert.deepEqual(matchMachines('Bambu Lab P1S', all).map((m) => m.id), ['bambu-p1s']);
});

test('every preset machine matches its own make and model uniquely', () => {
  const all = MACHINE_PRESETS.map((p) => machineFrom(p.id));
  for (const p of MACHINE_PRESETS) {
    assert.deepEqual(matchMachines(machinePresetLabel(p), all).map((m) => m.id), [p.id], p.id);
  }
});

test('owning an A1 and an A1 mini still auto-selects the right one', () => {
  const both = [machineFrom('bambu-a1'), machineFrom('bambu-a1-mini')];
  assert.deepEqual(matchMachines('Bambu Lab A1', both).map((m) => m.id), ['bambu-a1']);
  assert.deepEqual(matchMachines('Bambu Lab A1 mini', both).map((m) => m.id), ['bambu-a1-mini']);
});

test('containment matching still works when nothing matches exactly', () => {
  const garage = [{ id: 'g', name: 'Garage', make: null, model: 'P1S' }];
  assert.deepEqual(matchMachines('Bambu Lab P1S', garage).map((m) => m.id), ['g']);
});

test('a preset material is matched by the filament_type in a file', () => {
  const mats = MATERIAL_PRESETS.map((p) => ({ id: p.id, name: p.name, category: p.category, brand: null }));
  const r = matchMaterial('PETG', null, mats, '');
  assert.equal(r.kind, 'select');
  if (r.kind === 'select') assert.equal(r.material.id, 'generic-petg');
});
