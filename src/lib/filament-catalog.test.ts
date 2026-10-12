// filament-catalog.test.ts
// Run with:  npm run test:filament-catalog
//
// Checks the picker logic on a small fixture, and the shipped catalog file
// against a real Bambu Studio export (Large - Foot plate, A1, Maroon Red).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  filamentHintFromConfig,
  findCatalogMatch,
  materialFromPick,
  normHex,
  type FilamentCatalog,
} from './filament-catalog.ts';

const FIXTURE: FilamentCatalog = {
  source: 'test',
  licence: 'MIT',
  generated: '2026-10-12',
  counts: { brands: 3, lines: 4, colours: 6 },
  brands: [
    [
      'Bambu Lab',
      [
        ['PLA Basic', 'PLA', 1.26, [['Black', '#000000'], ['Maroon Red', '#9D2235']]],
        ['PLA Matte', 'PLA', 1.31, [['Charcoal', '#000000'], ['Dark Red', '#BB3D43']]],
      ],
    ],
    ['Prusament', [['Prusament PLA', 'PLA', 1.24, [['Galaxy Black', '#3D3E3D']]]]],
    ['SUNLU', [['PETG', 'PETG', 1.27, [['Black', '#000000']]]]],
  ],
};

test('hex codes are normalised from every way slicers write them', () => {
  assert.equal(normHex('#9d2235'), '#9D2235');
  assert.equal(normHex('9D2235'), '#9D2235');
  assert.equal(normHex('#9D2235FF'), '#9D2235');
  assert.equal(normHex('#9D2235;#FFFFFF'), '#9D2235');
  assert.equal(normHex('"#9D2235"'), '#9D2235');
  assert.equal(normHex(''), null);
  assert.equal(normHex('red'), null);
  assert.equal(normHex(null), null);
});

test('a pick becomes a material without the brand twice, and without a price', () => {
  const m = materialFromPick({ brand: 'Prusament', line: 'Prusament PLA', material: 'PLA', density: 1.24, colourName: 'Galaxy Black', hex: '#3D3E3D' });
  assert.equal(m.name, 'Prusament PLA Galaxy Black');
  assert.equal(m.category, 'PLA');
  assert.equal(m.color_hex, '#3D3E3D');
  assert.equal(m.diameter_mm, 1.75);
  assert.equal('cost_per_unit' in m, false);
  const b = materialFromPick({ brand: 'Bambu Lab', line: 'PLA Basic', material: 'PLA', density: 1.26, colourName: 'Maroon Red', hex: '#9D2235' });
  assert.equal(b.name, 'Bambu Lab PLA Basic Maroon Red');
});

test('a file hint is read from the slicer settings, and needs a colour', () => {
  const hint = filamentHintFromConfig({
    filament_vendor: '"Bambu Lab"',
    filament_settings_id: '"Bambu PLA Basic @BBL A1"',
    filament_type: 'PLA',
    filament_colour: '#9D2235',
  });
  assert.deepEqual(hint, { vendor: 'Bambu Lab', settingsId: 'Bambu PLA Basic @BBL A1', type: 'PLA', hex: '#9D2235' });
  assert.equal(filamentHintFromConfig({ filament_type: 'PLA' }), null);
  assert.equal(filamentHintFromConfig(null), null);
});

test('the profile name settles a colour two lines share', () => {
  const basic = findCatalogMatch(FIXTURE, { vendor: 'Bambu Lab', settingsId: 'Bambu PLA Basic @BBL A1', type: 'PLA', hex: '#000000' });
  assert.equal(basic?.line, 'PLA Basic');
  assert.equal(basic?.colourName, 'Black');
  const matte = findCatalogMatch(FIXTURE, { vendor: 'Bambu Lab', settingsId: 'Bambu PLA Matte @BBL X1C', type: 'PLA', hex: '#000000' });
  assert.equal(matte?.line, 'PLA Matte');
});

test('nothing is guessed when the colour is shared and the profile does not say which', () => {
  assert.equal(findCatalogMatch(FIXTURE, { vendor: 'Bambu Lab', settingsId: 'Generic PLA', type: 'PLA', hex: '#000000' }), null);
  assert.equal(findCatalogMatch(FIXTURE, { vendor: null, settingsId: null, type: null, hex: '#000000' }), null);
});

test('type and vendor narrow the search', () => {
  assert.equal(findCatalogMatch(FIXTURE, { vendor: 'SUNLU', settingsId: null, type: 'PETG', hex: '#000000' })?.brand, 'SUNLU');
  assert.equal(findCatalogMatch(FIXTURE, { vendor: 'Bambu Lab', settingsId: null, type: 'PLA', hex: '#9D2235' })?.colourName, 'Maroon Red');
  assert.equal(findCatalogMatch(FIXTURE, { vendor: 'Bambu Lab', settingsId: null, type: 'PETG', hex: '#9D2235' }), null);
  assert.equal(findCatalogMatch(FIXTURE, { vendor: 'Bambu Lab', settingsId: null, type: 'PLA', hex: '#123456' }), null);
});

test('the shipped catalog finds the filament in a real A1 export', () => {
  const catalog = JSON.parse(readFileSync(new URL('../../public/catalog/filaments.json', import.meta.url), 'utf8')) as FilamentCatalog;
  assert.ok(catalog.counts.colours > 10_000, 'catalog looks complete');
  assert.match(catalog.licence, /MIT/);
  const pick = findCatalogMatch(catalog, {
    vendor: 'Bambu Lab',
    settingsId: 'Bambu PLA Basic @BBL A1',
    type: 'PLA',
    hex: '#9D2235',
  });
  assert.deepEqual(pick && { brand: pick.brand, line: pick.line, colour: pick.colourName }, {
    brand: 'Bambu Lab',
    line: 'PLA Basic',
    colour: 'Maroon Red',
  });
  for (const [brand, lines] of catalog.brands) {
    for (const [, , , colours] of lines) {
      for (const [, hex] of colours) assert.match(hex, /^#[0-9A-F]{6}$/, brand);
    }
  }
});
