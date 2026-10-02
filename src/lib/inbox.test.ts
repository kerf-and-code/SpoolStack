// inbox.test.ts
// Run with:  npm run test:inbox
//
// The pieces the "Did it print?" inbox decides with: when one tap is safe,
// and how a stored upload becomes run values.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INBOX_DAYS, inboxCutoffIso, resolveSetup, type MachineRow, type MaterialRow } from './inbox-match.ts';
import { acceptImportedParameters, importMetadata, storedParse, type ImportDef } from './import-record.ts';

const A1: MachineRow = { id: 'm1', name: 'Bambu A1', make: 'Bambu Lab', model: 'A1', domain_id: 'fdm' };
const A1MINI: MachineRow = { id: 'm2', name: 'A1 mini', make: 'Bambu Lab', model: 'A1 mini', domain_id: 'fdm' };
const PLA: MaterialRow = { id: 'f1', name: 'PLA Basic Black', category: 'PLA', brand: 'Bambu Lab', domain_id: 'fdm' };
const PLA2: MaterialRow = { id: 'f2', name: 'Polymaker PLA', category: 'PLA', brand: 'Polymaker', domain_id: 'fdm' };
const PETG: MaterialRow = { id: 'f3', name: 'PETG Grey', category: 'PETG', brand: 'Sunlu', domain_id: 'fdm' };

test('one tap only when the machine and material are both certain', () => {
  const r = resolveSetup('Bambu Lab A1', 'PLA', 'Bambu Lab', [A1, A1MINI], [PLA, PETG]);
  assert.equal(r.machine?.id, 'm1', 'exact model wins over the A1 mini');
  assert.equal(r.material?.id, 'f1');
});

test('two PLAs are told apart by brand, or left for the form', () => {
  assert.equal(resolveSetup('Bambu Lab A1', 'PLA', 'Bambu Lab', [A1], [PLA, PLA2]).material?.id, 'f1');
  assert.equal(resolveSetup('Bambu Lab A1', 'PLA', 'Generic', [A1], [PLA, PLA2]).material, null);
});

test('an unknown printer or filament is never guessed', () => {
  assert.equal(resolveSetup('Prusa MK4', 'PLA', null, [A1], [PLA]).machine, null);
  assert.equal(resolveSetup('Bambu Lab A1', 'ASA', null, [A1], [PLA]).material, null);
});

test('a file with no printer or filament named uses your only machine and material', () => {
  const r = resolveSetup(null, null, null, [A1], [PLA]);
  assert.equal(r.machine?.id, 'm1');
  assert.equal(r.material?.id, 'f1');
  const two = resolveSetup(null, null, null, [A1, A1MINI], [PLA, PETG]);
  assert.equal(two.machine, null);
  assert.equal(two.material, null);
});

test('the inbox looks back two weeks', () => {
  const now = Date.UTC(2026, 9, 15, 12, 0, 0);
  assert.equal(INBOX_DAYS, 14);
  assert.equal(inboxCutoffIso(now), '2026-10-01T12:00:00.000Z');
});

test('a stored upload reads back safely, even when damaged', () => {
  const p = storedParse({
    durationMinutes: 266.98,
    materialQtyUsedG: 135.88,
    materialSource: 'stated_grams',
    filamentType: 'PLA',
    printerModel: 'Bambu Lab A1',
    parameters: { nozzle_temp: 220 },
    warnings: ['x', 3],
    config_format: 'bambu_orca',
    config_skipped: 17,
  });
  assert.equal(p.durationMinutes, 266.98);
  assert.equal(p.materialSource, 'stated_grams');
  assert.deepEqual(p.warnings, ['x']);
  assert.equal(p.config_skipped, 17);

  const junk = storedParse({ durationMinutes: 'soon', materialSource: 'guess', parameters: [1], raw: null });
  assert.equal(junk.durationMinutes, null);
  assert.equal(junk.materialSource, null);
  assert.deepEqual(junk.parameters, {});
  assert.deepEqual(storedParse(null).raw, {});
});

const DEFS: ImportDef[] = [
  { key: 'nozzle_temp', display_name: 'Nozzle temperature', unit: 'C', min_value: 150, max_value: 350, data_type: 'number', enum_options: null, domain_id: 'fdm' },
  { key: 'layer_height', display_name: 'Layer height', unit: 'mm', min_value: 0.04, max_value: 1, data_type: 'number', enum_options: null, domain_id: 'fdm' },
];

test('out-of-range settings from a file are shown, not stored', () => {
  const r = acceptImportedParameters({ nozzle_temp: 400, layer_height: 0.2, made_up: 1 }, DEFS);
  assert.deepEqual(r.accepted, { layer_height: 0.2 });
  assert.equal(r.outOfRange.length, 1);
  assert.equal(r.outOfRange[0].label, 'Nozzle temperature');
  assert.ok('made_up' in r.validation.rejected, 'a key not in the dictionary is rejected');
});

test('an uploaded file is marked as such in the run record', () => {
  const parsed = storedParse({ slicer: 'BambuStudio 02.08.02.60', raw: { time: '4h 26m 59s' } });
  const { validation } = acceptImportedParameters({}, DEFS);
  const meta = importMetadata(
    parsed,
    { format: 'bambu_orca', skipped: 17 },
    { fileName: 'foot.gcode', kind: 'gcode', plate: null, notes: [], pendingId: 'p1' },
    validation,
  );
  assert.equal(meta.via, 'slicer_uploader');
  assert.equal(meta.pending_id, 'p1');
  assert.equal(meta.config_skipped, 17);
  const picked = importMetadata(parsed, { format: null, skipped: 0 }, { fileName: 'x.gcode', kind: 'gcode', plate: null, notes: [] }, validation);
  assert.equal('via' in picked, false);
});
