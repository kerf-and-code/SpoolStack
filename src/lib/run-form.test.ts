// run-form.test.ts
// Run with:  npm run test:run-form
// (node --experimental-strip-types src/lib/run-form.test.ts)
//
// Covers the two pure pieces the run form depends on: duration parsing and
// form-field -> runs.parameters parsing against parameter_defs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, parseDurationMinutes } from './duration.ts';
import { parameterDefsFixture } from './run-form.fixtures.ts';
import { parametersToFields, parseParameterFields } from './run-params.ts';

const minutes = (s: string) => {
  const r = parseDurationMinutes(s);
  return r.ok ? r.minutes : `error: ${r.message}`;
};

// --------------------------------------------------------------------------
// duration
// --------------------------------------------------------------------------

test('duration: every way people type it', () => {
  assert.equal(minutes('134'), 134);
  assert.equal(minutes('2:14'), 134);
  assert.equal(minutes('2:14:30'), 134.5);
  assert.equal(minutes('2h 14m'), 134);
  assert.equal(minutes('2h14m'), 134);
  assert.equal(minutes('2 hours 14 min'), 134);
  assert.equal(minutes('45m'), 45);
  assert.equal(minutes('1d 2h'), 1560);
  assert.equal(minutes('  2H 14M  '), 134);
});

test('duration: decimals in unit form are read correctly (1.5h is 90, not 300)', () => {
  assert.equal(minutes('1.5h'), 90);
  assert.equal(minutes('0.5h'), 30);
});

test('duration: blank is unknown, not zero', () => {
  assert.deepEqual(parseDurationMinutes(''), { ok: true, minutes: null });
  assert.deepEqual(parseDurationMinutes('   '), { ok: true, minutes: null });
});

test('duration: rubbish and half-parses fail', () => {
  for (const bad of ['abc', '2 apples', '2h banana', '5 ms', '2:75', '0', '-5']) {
    const r = parseDurationMinutes(bad);
    assert.equal(r.ok, false, `expected "${bad}" to fail`);
  }
});

test('duration: over 30 days is rejected as a typo', () => {
  assert.equal(parseDurationMinutes('50000').ok, false);
});

test('formatDuration', () => {
  assert.equal(formatDuration(134), '2h 14m');
  assert.equal(formatDuration(45), '45m');
  assert.equal(formatDuration(120), '2h');
  assert.equal(formatDuration(0.5), '30s');
  assert.equal(formatDuration(null), '');
});

// --------------------------------------------------------------------------
// parameters
// --------------------------------------------------------------------------

const defs = parameterDefsFixture;

test('parameters: typed values land in the bag with the right types', () => {
  const r = parseParameterFields(
    {
      'p.nozzle_temp': '215',
      'p.layer_height': '0.2',
      'p.wall_count': '3',
      'p.infill_pattern': 'gyroid',
      'p.filament_dried': 'yes',
      'p.supports': 'no',
    },
    defs,
  );
  assert.deepEqual(r.errors, {});
  assert.deepEqual(r.values, {
    nozzle_temp: 215,
    layer_height: 0.2,
    wall_count: 3,
    infill_pattern: 'gyroid',
    filament_dried: true,
    supports: false,
  });
});

test('parameters: blank optional fields are omitted, never stored as zero or false', () => {
  const r = parseParameterFields({ 'p.nozzle_temp': '210', 'p.layer_height': '0.2', 'p.filament_dried': '', 'p.bed_temp': '' }, defs);
  assert.deepEqual(r.errors, {});
  assert.equal('filament_dried' in r.values, false);
  assert.equal('bed_temp' in r.values, false);
});

test('parameters: required fields are enforced', () => {
  const r = parseParameterFields({}, defs);
  assert.equal(r.errors['p.nozzle_temp'], 'Nozzle temperature is required.');
  assert.equal(r.errors['p.layer_height'], 'Layer height is required.');
});

test('parameters: out of range is an error with the range, NOT a silent clamp', () => {
  const r = parseParameterFields({ 'p.nozzle_temp': '2100', 'p.layer_height': '0.2' }, defs);
  assert.equal(r.errors['p.nozzle_temp'], 'Nozzle temperature must be between 150 and 350 C.');
  assert.equal('nozzle_temp' in r.values, false);
});

test('parameters: bad number, bad integer, bad enum, bad boolean', () => {
  const r = parseParameterFields(
    {
      'p.nozzle_temp': 'hot',
      'p.layer_height': '0.2',
      'p.wall_count': '2.5',
      'p.infill_pattern': 'spaghetti',
      'p.filament_dried': 'maybe',
    },
    defs,
  );
  assert.equal(r.errors['p.nozzle_temp'], 'Nozzle temperature must be a number.');
  assert.equal(r.errors['p.wall_count'], 'Wall count must be a whole number.');
  assert.match(r.errors['p.infill_pattern'], /listed options/);
  assert.match(r.errors['p.filament_dried'], /yes or no/);
});

test('parameters: fields not in the dictionary never reach the bag', () => {
  const r = parseParameterFields({ 'p.nozzle_temp': '210', 'p.layer_height': '0.2', 'p.made_up': '5' }, defs);
  assert.equal('made_up' in r.values, false);
});

test('parameters: round-trip through parametersToFields for copy-from-last-run', () => {
  const stored = { nozzle_temp: 215, layer_height: 0.2, filament_dried: false, infill_pattern: 'grid' };
  const fields = parametersToFields(stored, defs);
  assert.deepEqual(fields, {
    'p.nozzle_temp': '215',
    'p.layer_height': '0.2',
    'p.filament_dried': 'no',
    'p.infill_pattern': 'grid',
  });
  const back = parseParameterFields(fields, defs);
  assert.deepEqual(back.values, stored);
});
