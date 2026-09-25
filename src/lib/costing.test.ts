// costing.test.ts
// Run with:  npm run test:costing
// (node --experimental-strip-types src/lib/costing.test.ts)
//
// The TypeScript costing must agree with the SQL view it mirrors. The view
// rows in costing.fixtures.ts were read from Postgres, so this is a check
// against the database's own arithmetic, not against numbers typed by hand.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEW_ROWS } from './costing.fixtures.ts';
import { computeRunCost, costPerSuccess, costPerUnitFromPackage, gramsFromLength, round4 } from './costing.ts';

const close = (actual: number | null, expected: number | null, label: string) => {
  if (expected === null) {
    assert.equal(actual, null, `${label}: expected null, got ${actual}`);
    return;
  }
  assert.ok(actual !== null, `${label}: expected ${expected}, got null`);
  assert.ok(Math.abs(actual - expected) <= 0.0001 + 1e-9, `${label}: expected ${expected}, got ${actual}`);
};

for (const row of VIEW_ROWS) {
  test(`matches the view: run ${row.run_id.slice(-4)}, ${row.case}`, () => {
    const out = computeRunCost({
      materialQtyUsed: row.material_qty_used,
      materialCostPerUnit: row.material_cost_per_unit,
      durationMinutes: row.duration_minutes,
      powerWatts: row.power_watts,
      electricityRatePerKwh: row.electricity_rate_per_kwh,
      machinePurchaseCost: row.machine_purchase_cost,
      expectedLifeHours: row.expected_life_hours,
      maintenanceCostPerHour: row.maintenance_cost_per_hour,
      activeLaborMinutes: row.active_labor_minutes,
      laborRatePerHour: row.labor_rate_per_hour,
      includeLabor: row.include_labor_in_cost === true,
      unitsProduced: row.units_produced,
      unitsGood: row.units_good,
    });
    close(out.materialCost, row.material_cost, 'material');
    close(out.energyCost, row.energy_cost, 'energy');
    close(out.machineCost, row.machine_cost, 'machine');
    close(out.laborCost, row.labor_cost, 'labor');
    close(out.totalCost, row.total_cost, 'total');
    close(out.costPerUnitProduced, row.cost_per_unit_produced, 'per unit produced');
    close(out.costPerGoodUnit, row.cost_per_good_unit, 'per good unit');
    // The view also names 'material' and 'machine' for runs without one;
    // those are app facts, added by the app, not by this module.
    const expected = row.missing_inputs.filter((m) => m !== 'material' && m !== 'machine');
    assert.deepEqual(out.missingInputs, expected);
    assert.equal(out.costComplete, expected.length === 0);
  });
}

test('the fixtures cover the edge cases they claim to', () => {
  const zeroGood = VIEW_ROWS.find((r) => r.units_good === 0);
  assert.ok(zeroGood, 'a run with zero good parts');
  assert.equal(zeroGood.cost_per_good_unit, null);
  const maintOnly = VIEW_ROWS.find((r) => r.maintenance_cost_per_hour !== null && r.machine_purchase_cost === null);
  assert.ok(maintOnly, 'maintenance without depreciation');
  assert.equal(maintOnly.machine_cost, null);
  assert.ok(VIEW_ROWS.some((r) => r.duration_minutes === null));
  assert.ok(VIEW_ROWS.some((r) => r.include_labor_in_cost === false));
});

test('round4 rounds half away from zero', () => {
  assert.equal(round4(1.23455), 1.2346);
  assert.equal(round4(-1.23455), -1.2346);
  assert.equal(round4(0), 0);
});

test('price per gram from a spool', () => {
  assert.equal(costPerUnitFromPackage(24.99, 1000), 0.02499);
  assert.equal(costPerUnitFromPackage(24.99, 0), null);
  assert.equal(costPerUnitFromPackage(null, 1000), null);
});

test('grams from filament length', () => {
  // 1 m of 1.75 mm PLA at 1.24 g/cm3 is about 2.98 g.
  const g = gramsFromLength(1, 1.75, 1.24);
  assert.ok(g !== null && Math.abs(g - 2.9825) < 0.001, String(g));
  assert.equal(gramsFromLength(null, 1.75, 1.24), null);
});

test('cost per success spreads failures over the good prints', () => {
  assert.equal(costPerSuccess(4, 80), 5);
  assert.equal(costPerSuccess(4, 100), 4);
  assert.equal(costPerSuccess(4, 0), null);
  assert.equal(costPerSuccess(4, null), null);
  assert.equal(costPerSuccess(4, 120), null);
});

test('blank inputs stay unknown instead of becoming zero', () => {
  const out = computeRunCost({
    materialQtyUsed: 50,
    materialCostPerUnit: 0.02,
    durationMinutes: 120,
    powerWatts: null,
    electricityRatePerKwh: 0.15,
    machinePurchaseCost: null,
    expectedLifeHours: null,
    maintenanceCostPerHour: null,
    activeLaborMinutes: 0,
    laborRatePerHour: null,
    includeLabor: false,
    unitsProduced: 1,
    unitsGood: null,
  });
  assert.equal(out.materialCost, 1);
  assert.equal(out.energyCost, null);
  assert.equal(out.machineCost, null);
  assert.equal(out.totalCost, 1);
  assert.equal(out.costComplete, false);
  assert.deepEqual(out.missingInputs, ['machine_power_watts', 'machine_depreciation_inputs']);
});
