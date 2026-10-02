// run-diff.test.ts
// Run with:  npm run test:run-diff

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffParameters, type DiffDef } from './run-diff.ts';

const DEFS: DiffDef[] = [
  { key: 'nozzle_temp', display_name: 'Nozzle temperature', unit: 'C', sort_order: 10 },
  { key: 'layer_height', display_name: 'Layer height', unit: 'mm', sort_order: 20 },
  { key: 'bed_adhesion', display_name: 'Bed adhesion', unit: null, sort_order: 30 },
  { key: 'supports', display_name: 'Supports', unit: null, sort_order: 40 },
];

test('only changed settings, in dictionary order, with units', () => {
  const before = { layer_height: 0.2, nozzle_temp: 220, bed_adhesion: 'none' };
  const after = { layer_height: 0.2, nozzle_temp: 210, bed_adhesion: 'brim' };
  assert.deepEqual(diffParameters(before, after, DEFS), [
    { key: 'nozzle_temp', label: 'Nozzle temperature', before: '220 C', after: '210 C' },
    { key: 'bed_adhesion', label: 'Bed adhesion', before: 'none', after: 'brim' },
  ]);
});

test('a setting recorded on only one side shows as not recorded', () => {
  const changes = diffParameters({ nozzle_temp: 220 }, { nozzle_temp: 220, supports: true }, DEFS);
  assert.deepEqual(changes, [{ key: 'supports', label: 'Supports', before: 'not recorded', after: 'Yes' }]);
});

test('identical runs, empty bags and junk give no changes', () => {
  assert.deepEqual(diffParameters({ nozzle_temp: 215 }, { nozzle_temp: 215 }, DEFS), []);
  assert.deepEqual(diffParameters({}, {}, DEFS), []);
  assert.deepEqual(diffParameters(null, [1, 2], DEFS), []);
});

test('keys no longer in the dictionary come last under their raw name', () => {
  const changes = diffParameters({ old_key: 1, nozzle_temp: 220 }, { old_key: 2, nozzle_temp: 225 }, DEFS);
  assert.deepEqual(
    changes.map((c) => c.label),
    ['Nozzle temperature', 'old_key'],
  );
});

test('floating point noise is not a change', () => {
  assert.deepEqual(diffParameters({ layer_height: 0.1 + 0.2 }, { layer_height: 0.3 }, DEFS), []);
});
