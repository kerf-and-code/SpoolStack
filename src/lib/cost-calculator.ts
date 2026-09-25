// The print cost calculator's form model: which fields exist, how they map
// to URL query keys (so a calculation can be shared as a link), and how the
// typed strings become costing.ts inputs. Kept apart from the component so
// the parsing can be tested without a browser.

import { computeRunCost, costPerSuccess, costPerUnitFromPackage, gramsFromLength, type CostBreakdown, type MissingInput } from './costing.ts';
import { parseDurationMinutes } from './duration.ts';
import { MATERIAL_DENSITY_G_CM3 } from './gcodeParse.ts';

export const CALC_FIELDS = [
  'currency',
  'spoolPrice',
  'spoolGrams',
  'amountMode',
  'grams',
  'lengthM',
  'material',
  'diameter',
  'printTime',
  'watts',
  'rate',
  'machinePrice',
  'lifeHours',
  'maintPerHour',
  'laborMinutes',
  'laborRate',
  'parts',
  'successRate',
] as const;

export type CalcField = (typeof CALC_FIELDS)[number];
export type CalcValues = Record<CalcField, string>;

export const CALC_CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'NZD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK', 'MXN', 'BRL', 'INR'];

export const CALC_MATERIALS = Object.keys(MATERIAL_DENSITY_G_CM3);

export const EMPTY_VALUES: CalcValues = {
  currency: 'USD',
  spoolPrice: '',
  spoolGrams: '',
  amountMode: 'grams',
  grams: '',
  lengthM: '',
  material: 'PLA',
  diameter: '1.75',
  printTime: '',
  watts: '',
  rate: '',
  machinePrice: '',
  lifeHours: '',
  maintPerHour: '',
  laborMinutes: '',
  laborRate: '',
  parts: '1',
  successRate: '',
};

/**
 * A worked example: the 4h 27m A1 print used across the site. The power
 * draw and prices are illustrative, not presets, and the form says so.
 */
export const EXAMPLE_VALUES: CalcValues = {
  ...EMPTY_VALUES,
  spoolPrice: '20',
  spoolGrams: '1000',
  grams: '135.88',
  printTime: '4h 27m',
  watts: '90',
  rate: '0.13',
  machinePrice: '400',
  lifeHours: '5000',
  successRate: '80',
};

/** Values from a URL's query string. Unknown keys are ignored; bad ones fall back. */
export function valuesFromQuery(query: Record<string, string | string[] | undefined>): CalcValues {
  const out: CalcValues = { ...EMPTY_VALUES };
  for (const field of CALC_FIELDS) {
    const raw = query[field];
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (typeof v === 'string' && v.length <= 40) out[field] = v;
  }
  if (!CALC_CURRENCIES.includes(out.currency)) out.currency = 'USD';
  if (out.amountMode !== 'grams' && out.amountMode !== 'length') out.amountMode = 'grams';
  if (!CALC_MATERIALS.includes(out.material)) out.material = 'PLA';
  if (out.diameter !== '1.75' && out.diameter !== '2.85') out.diameter = '1.75';
  return out;
}

/** Only the fields that differ from empty, so shared links stay short. */
export function queryFromValues(values: CalcValues): string {
  const params = new URLSearchParams();
  for (const field of CALC_FIELDS) {
    if (values[field] !== EMPTY_VALUES[field]) params.set(field, values[field]);
  }
  return params.toString();
}

/** A typed number: blank is null, anything unreadable or negative is an error. */
export function parseAmount(raw: string): { value: number | null; error: boolean } {
  const s = raw.trim().replace(/,/g, '');
  if (s === '') return { value: null, error: false };
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return { value: null, error: true };
  return { value: n, error: false };
}

export interface CalcResult {
  breakdown: CostBreakdown;
  grams: number | null;
  gramsEstimated: boolean;
  pricePerGram: number | null;
  durationMinutes: number | null;
  parts: number;
  perSuccessfulPrint: number | null;
  perSuccessfulPart: number | null;
  includeLabor: boolean;
  /** Fields the user typed that could not be read. */
  errors: Partial<Record<CalcField, string>>;
}

export function calculate(values: CalcValues): CalcResult {
  const errors: Partial<Record<CalcField, string>> = {};
  const num = (field: CalcField): number | null => {
    const r = parseAmount(values[field]);
    if (r.error) errors[field] = 'Enter a number, 0 or more.';
    return r.value;
  };

  const spoolPrice = num('spoolPrice');
  const spoolGrams = num('spoolGrams');
  const pricePerGram = costPerUnitFromPackage(spoolPrice, spoolGrams);

  let grams: number | null;
  let gramsEstimated = false;
  if (values.amountMode === 'length') {
    const density = MATERIAL_DENSITY_G_CM3[values.material] ?? MATERIAL_DENSITY_G_CM3.PLA;
    grams = gramsFromLength(num('lengthM'), Number(values.diameter), density);
    gramsEstimated = grams !== null;
  } else {
    grams = num('grams');
  }

  const duration = parseDurationMinutes(values.printTime);
  if (!duration.ok) errors.printTime = duration.message;
  const durationMinutes = duration.ok ? duration.minutes : null;

  const laborMinutes = num('laborMinutes');
  const laborRate = num('laborRate');
  // Labour counts once either labour field is filled: a rate with no minutes
  // is zero minutes of work, minutes with no rate are a missing rate.
  const includeLabor = laborMinutes !== null || laborRate !== null;

  const partsRaw = num('parts');
  let parts = 1;
  if (partsRaw !== null) {
    if (!Number.isInteger(partsRaw) || partsRaw < 1) errors.parts = 'Whole parts, 1 or more.';
    else parts = partsRaw;
  }

  const successRate = num('successRate');
  if (successRate !== null && (successRate <= 0 || successRate > 100)) {
    errors.successRate = 'A percentage above 0, up to 100.';
  }

  const breakdown = computeRunCost({
    materialQtyUsed: grams,
    materialCostPerUnit: pricePerGram,
    durationMinutes,
    powerWatts: num('watts'),
    electricityRatePerKwh: num('rate'),
    machinePurchaseCost: num('machinePrice'),
    expectedLifeHours: num('lifeHours'),
    maintenanceCostPerHour: num('maintPerHour'),
    activeLaborMinutes: laborMinutes ?? 0,
    laborRatePerHour: laborRate,
    includeLabor,
    unitsProduced: parts,
    unitsGood: null,
  });

  const rate = errors.successRate ? null : successRate;
  return {
    breakdown,
    grams,
    gramsEstimated,
    pricePerGram,
    durationMinutes,
    parts,
    perSuccessfulPrint: costPerSuccess(breakdown.totalCost, rate),
    perSuccessfulPart:
      breakdown.costPerUnitProduced === null ? null : costPerSuccess(breakdown.costPerUnitProduced, rate),
    includeLabor,
    errors,
  };
}

/** Plain-language names for what is missing, for the "not included" notes. */
export const MISSING_LABELS: Record<MissingInput, string> = {
  duration_minutes: 'print time',
  material_qty_used: 'filament used',
  material_cost_per_unit: 'spool price and weight',
  machine_power_watts: 'printer power draw',
  electricity_rate_per_kwh: 'electricity rate',
  machine_depreciation_inputs: 'printer price and expected life',
  labor_rate_per_hour: 'hourly rate',
};
