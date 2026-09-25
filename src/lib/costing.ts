// Run costing, as pure functions.
//
// This is the TypeScript twin of the run_cost_breakdown view in
// db/schema.sql, formula for formula, including which inputs count as
// missing. The public print cost calculator uses it today; the Phase 2
// screens in the app will use it to explain the view's numbers. If a formula
// changes, it changes in both places in the same commit, and
// costing.test.ts checks the two against each other's worked examples.
//
// The rule inherited from the schema: blank means unknown, never zero. A cost
// line whose inputs are missing is null, the missing input is named, and the
// total is marked incomplete rather than quietly summing a zero.
//
// One deliberate difference: the view also lists 'material' and 'machine'
// when a run has no material or machine chosen. Those are facts about app
// rows, so the app adds them; this module only sees the numbers.

export interface CostInputs {
  /** Grams (or the material's unit) used by the run. */
  materialQtyUsed: number | null;
  /** Price per gram (or per unit). See costPerUnitFromPackage. */
  materialCostPerUnit: number | null;
  durationMinutes: number | null;
  /** Average draw while printing, not the nameplate figure. */
  powerWatts: number | null;
  electricityRatePerKwh: number | null;
  machinePurchaseCost: number | null;
  expectedLifeHours: number | null;
  maintenanceCostPerHour: number | null;
  activeLaborMinutes: number | null;
  laborRatePerHour: number | null;
  includeLabor: boolean;
  /** Parts on the plate. Defaults to 1, as runs.units_produced does. */
  unitsProduced: number | null;
  /** Parts that came out usable. Null means all of them. */
  unitsGood: number | null;
}

/** The names the view uses in missing_inputs, so both say the same thing. */
export type MissingInput =
  | 'duration_minutes'
  | 'material_qty_used'
  | 'material_cost_per_unit'
  | 'machine_power_watts'
  | 'electricity_rate_per_kwh'
  | 'machine_depreciation_inputs'
  | 'labor_rate_per_hour';

export interface CostBreakdown {
  materialCost: number | null;
  energyCost: number | null;
  machineCost: number | null;
  laborCost: number | null;
  totalCost: number;
  costPerUnitProduced: number | null;
  costPerGoodUnit: number | null;
  missingInputs: MissingInput[];
  costComplete: boolean;
}

/**
 * round(x, 4), half away from zero, as Postgres rounds numerics. Postgres
 * works in exact decimals and this works in binary floats, so the two can
 * differ by 0.0001 on rare values. Money is shown to 2 places, where that
 * never shows.
 */
export function round4(x: number): number {
  const r = Math.round(Math.abs(x) * 10_000) / 10_000;
  return x < 0 ? -r : r;
}

/** Multiplication that stays null when any factor is null, like SQL. */
function mul(...xs: (number | null)[]): number | null {
  let out = 1;
  for (const x of xs) {
    if (x === null || !Number.isFinite(x)) return null;
    out *= x;
  }
  return out;
}

function roundOrNull(x: number | null): number | null {
  return x === null ? null : round4(x);
}

export function computeRunCost(i: CostInputs): CostBreakdown {
  const hours = i.durationMinutes === null ? null : i.durationMinutes / 60;

  const materialCost = roundOrNull(mul(i.materialQtyUsed, i.materialCostPerUnit));
  const energyCost = roundOrNull(
    mul(i.powerWatts === null ? null : i.powerWatts / 1000, hours, i.electricityRatePerKwh),
  );

  // purchase / nullif(life, 0): a zero life is treated as unknown, not as
  // infinity. Maintenance on its own does not make the line known, because
  // in SQL null + maintenance is still null.
  const depreciationPerHour =
    i.machinePurchaseCost === null || i.expectedLifeHours === null || i.expectedLifeHours === 0
      ? null
      : i.machinePurchaseCost / i.expectedLifeHours;
  const machineCost = roundOrNull(
    mul(depreciationPerHour === null ? null : depreciationPerHour + (i.maintenanceCostPerHour ?? 0), hours),
  );

  const laborCost = i.includeLabor
    ? roundOrNull(mul(i.activeLaborMinutes === null ? null : i.activeLaborMinutes / 60, i.laborRatePerHour))
    : 0;

  const missingInputs: MissingInput[] = [];
  if (i.durationMinutes === null) missingInputs.push('duration_minutes');
  if (i.materialQtyUsed === null) missingInputs.push('material_qty_used');
  if (i.materialCostPerUnit === null) missingInputs.push('material_cost_per_unit');
  if (i.powerWatts === null) missingInputs.push('machine_power_watts');
  if (i.electricityRatePerKwh === null) missingInputs.push('electricity_rate_per_kwh');
  if (i.machinePurchaseCost === null || i.expectedLifeHours === null) missingInputs.push('machine_depreciation_inputs');
  if (i.includeLabor && i.laborRatePerHour === null) missingInputs.push('labor_rate_per_hour');

  const totalCost = (materialCost ?? 0) + (energyCost ?? 0) + (machineCost ?? 0) + (laborCost ?? 0);
  const produced = i.unitsProduced ?? 1;
  const good = i.unitsGood ?? produced;

  return {
    materialCost,
    energyCost,
    machineCost,
    laborCost,
    totalCost,
    costPerUnitProduced: produced === 0 ? null : round4(totalCost / produced),
    costPerGoodUnit: good === 0 ? null : round4(totalCost / good),
    missingInputs,
    costComplete: missingInputs.length === 0,
  };
}

/**
 * Price per unit from what a spool or pack cost and how much was in it, the
 * same derivation the materials form makes on save.
 */
export function costPerUnitFromPackage(packageCost: number | null, packageQty: number | null): number | null {
  if (packageCost === null || packageQty === null || packageQty <= 0) return null;
  return packageCost / packageQty;
}

/**
 * Grams of filament in a length, from diameter and density. For slicers that
 * report metres rather than grams.
 */
export function gramsFromLength(lengthM: number | null, diameterMm: number, densityGCm3: number): number | null {
  if (lengthM === null || lengthM < 0) return null;
  const radiusMm = diameterMm / 2;
  const volumeMm3 = Math.PI * radiusMm * radiusMm * lengthM * 1000;
  return (volumeMm3 / 1000) * densityGCm3;
}

/**
 * Spreading the cost of the failures over the prints that worked. With a
 * success rate of 80%, every good print carries a quarter of a failed one.
 * Returns null when the rate is unknown or not above zero.
 */
export function costPerSuccess(costPerAttempt: number, successRatePercent: number | null): number | null {
  if (successRatePercent === null || successRatePercent <= 0 || successRatePercent > 100) return null;
  return costPerAttempt / (successRatePercent / 100);
}
