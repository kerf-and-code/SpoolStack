// cost-calculator.test.ts
// Run with:  npm run test:costing
// The print cost calculator's form model: parsing, the shared-link round
// trip, and the worked example quoted on the home page.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_VALUES,
  EXAMPLE_VALUES,
  calculate,
  parseAmount,
  queryFromValues,
  valuesFromQuery,
} from './cost-calculator.ts';

const round2 = (x: number | null) => (x === null ? null : Math.round(x * 100) / 100);

test('the worked example matches the figures quoted on the site', () => {
  const r = calculate(EXAMPLE_VALUES);
  assert.equal(round2(r.breakdown.materialCost), 2.72);
  // 90 W, not 95: at 95 W the energy line is 0.0549575, which shows as 0.06
  // after rounding and makes the displayed lines add to 3.14 against a 3.13
  // total. The example is chosen so the shown numbers add up.
  assert.equal(round2(r.breakdown.energyCost), 0.05);
  const shown = [r.breakdown.materialCost, r.breakdown.energyCost, r.breakdown.machineCost].map((x) =>
    Number(new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(x ?? 0)),
  );
  assert.equal(Math.round(shown.reduce((a, b) => a + b, 0) * 100) / 100, 3.13);
  assert.equal(round2(r.breakdown.machineCost), 0.36);
  assert.equal(round2(r.breakdown.totalCost), 3.13);
  assert.equal(round2(r.perSuccessfulPrint), 3.91);
  assert.equal(r.durationMinutes, 267);
  assert.equal(r.includeLabor, false);
  assert.deepEqual(r.breakdown.missingInputs, []);
});

test('an empty form costs nothing and names everything as missing', () => {
  const r = calculate(EMPTY_VALUES);
  assert.equal(r.breakdown.totalCost, 0);
  assert.equal(r.breakdown.costComplete, false);
  assert.ok(r.breakdown.missingInputs.includes('material_qty_used'));
  assert.deepEqual(r.errors, {});
});

test('amounts: blank is unknown, junk and negatives are errors, thousands commas are fine', () => {
  assert.deepEqual(parseAmount(''), { value: null, error: false });
  assert.deepEqual(parseAmount('  '), { value: null, error: false });
  assert.deepEqual(parseAmount('1,000'), { value: 1000, error: false });
  assert.deepEqual(parseAmount('abc'), { value: null, error: true });
  assert.deepEqual(parseAmount('-3'), { value: null, error: true });
});

test('length mode converts metres to grams by material and diameter', () => {
  const r = calculate({ ...EMPTY_VALUES, amountMode: 'length', lengthM: '10', material: 'PETG', diameter: '1.75' });
  assert.ok(r.gramsEstimated);
  // 10 m of 1.75 mm at 1.27 g/cm3 = 30.55 g
  assert.equal(round2(r.grams), 30.55);
});

test('labour counts once either labour field is filled', () => {
  const minutesOnly = calculate({ ...EXAMPLE_VALUES, laborMinutes: '15' });
  assert.equal(minutesOnly.includeLabor, true);
  assert.equal(minutesOnly.breakdown.laborCost, null);
  assert.ok(minutesOnly.breakdown.missingInputs.includes('labor_rate_per_hour'));

  const both = calculate({ ...EXAMPLE_VALUES, laborMinutes: '15', laborRate: '20' });
  assert.equal(both.breakdown.laborCost, 5);
  assert.equal(round2(both.breakdown.totalCost), 8.13);
});

test('parts on the plate divide the cost, and must be whole', () => {
  const r = calculate({ ...EXAMPLE_VALUES, parts: '4' });
  assert.equal(r.parts, 4);
  assert.equal(round2(r.breakdown.costPerUnitProduced), 0.78);
  assert.equal(calculate({ ...EXAMPLE_VALUES, parts: '2.5' }).errors.parts !== undefined, true);
  assert.equal(calculate({ ...EXAMPLE_VALUES, parts: '0' }).errors.parts !== undefined, true);
});

test('success rate outside 0 to 100 is rejected, not used', () => {
  const r = calculate({ ...EXAMPLE_VALUES, successRate: '150' });
  assert.ok(r.errors.successRate);
  assert.equal(r.perSuccessfulPrint, null);
});

test('a bad print time is an error, not a zero', () => {
  const r = calculate({ ...EXAMPLE_VALUES, printTime: 'soon' });
  assert.ok(r.errors.printTime);
  assert.equal(r.durationMinutes, null);
  assert.equal(r.breakdown.energyCost, null);
});

test('shared links round-trip and stay short', () => {
  const q = queryFromValues(EXAMPLE_VALUES);
  assert.ok(!q.includes('currency='), 'defaults are left out');
  const back = valuesFromQuery(Object.fromEntries(new URLSearchParams(q)));
  assert.deepEqual(back, EXAMPLE_VALUES);
  assert.equal(queryFromValues(EMPTY_VALUES), '');
});

test('hostile or unknown query values fall back to defaults', () => {
  const v = valuesFromQuery({ currency: 'XXX', amountMode: 'volume', material: '<script>', diameter: '3', grams: 'x'.repeat(100) });
  assert.equal(v.currency, 'USD');
  assert.equal(v.amountMode, 'grams');
  assert.equal(v.material, 'PLA');
  assert.equal(v.diameter, '1.75');
  assert.equal(v.grams, '');
});
