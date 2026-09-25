'use client';

// The public print cost calculator. Every input is optional: each cost line
// appears as soon as its own inputs are filled, and anything left out is
// named under the total rather than counted as zero. The form is mirrored
// into the URL, so a calculation can be bookmarked or shared as a link.

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  CALC_CURRENCIES,
  CALC_MATERIALS,
  EMPTY_VALUES,
  EXAMPLE_VALUES,
  MISSING_LABELS,
  calculate,
  parseAmount,
  queryFromValues,
  type CalcField,
  type CalcValues,
} from '@/lib/cost-calculator';
import { formatMoney, formatNumber } from '@/lib/format';
import { formatDuration } from '@/lib/duration';

const inputClass =
  'w-full min-w-0 rounded-lg border-[1.5px] border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-ink focus:outline-none aria-[invalid=true]:border-red-600';

function Field({
  label,
  field,
  values,
  errors,
  onChange,
  suffix,
  placeholder,
  help,
  inputMode = 'decimal',
}: {
  label: string;
  field: CalcField;
  values: CalcValues;
  errors: Partial<Record<CalcField, string>>;
  onChange: (field: CalcField, value: string) => void;
  suffix?: string;
  placeholder?: string;
  help?: string;
  inputMode?: 'decimal' | 'numeric' | 'text';
}) {
  const id = `calc-${field}`;
  const error = errors[field];
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          id={id}
          name={field}
          inputMode={inputMode}
          autoComplete="off"
          value={values[field]}
          placeholder={placeholder}
          onChange={(e) => onChange(field, e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}
          className={inputClass}
        />
        {suffix ? <span className="shrink-0 font-mono text-xs text-muted">{suffix}</span> : null}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="mt-1 text-xs text-muted">
          {help}
        </p>
      ) : null}
    </div>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-line bg-panel/60 p-4 sm:p-5">
      <legend className="px-1 font-mono text-xs uppercase tracking-[0.14em] text-accent-text">; {title}</legend>
      {note ? <p className="mb-4 text-xs text-muted">{note}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function PrintCostCalculator({ initial }: { initial: CalcValues }) {
  const [values, setValues] = useState<CalcValues>(initial);
  const [copied, setCopied] = useState(false);
  const result = useMemo(() => calculate(values), [values]);
  const { breakdown, errors } = result;
  const money = (v: number | null, digits = 2) => (v === null ? '' : formatMoney(v, values.currency, digits));

  function update(next: CalcValues) {
    setValues(next);
    setCopied(false);
    const query = queryFromValues(next);
    // replaceState, not the router: every keystroke would otherwise add a
    // history entry and re-render the page on the server.
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  }

  const onChange = (field: CalcField, value: string) => update({ ...values, [field]: value });

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const hours = result.durationMinutes === null ? null : result.durationMinutes / 60;
  const n = (field: CalcField) => parseAmount(values[field]).value;
  const lines: { label: string; value: number | null; how: string | null; needs: string | null }[] = [
    {
      label: 'Filament',
      value: breakdown.materialCost,
      how:
        result.grams !== null && result.pricePerGram !== null
          ? `${formatNumber(result.grams, 2)} g x ${money(result.pricePerGram, 4)}/g${result.gramsEstimated ? ' (from length)' : ''}`
          : null,
      needs: breakdown.materialCost === null ? 'spool price, spool weight and filament used' : null,
    },
    {
      label: 'Electricity',
      value: breakdown.energyCost,
      how:
        breakdown.energyCost !== null && hours !== null
          ? `${formatNumber(hours, 2)} h x ${formatNumber(n('watts'), 1)} W x ${money(n('rate'), 4)}/kWh`
          : null,
      needs: breakdown.energyCost === null ? 'print time, power draw and electricity rate' : null,
    },
    {
      label: 'Machine wear',
      value: breakdown.machineCost,
      how: breakdown.machineCost !== null && hours !== null ? `${formatNumber(hours, 2)} h of printer life` : null,
      needs: breakdown.machineCost === null ? 'print time, printer price and expected life' : null,
    },
  ];
  if (result.includeLabor) {
    lines.push({
      label: 'Your time',
      value: breakdown.laborCost,
      how: breakdown.laborCost !== null ? `${formatNumber(n('laborMinutes') ?? 0, 1)} min at ${money(n('laborRate'))}/h` : null,
      needs: breakdown.laborCost === null ? 'hourly rate' : null,
    });
  }

  const anyCost = lines.some((l) => l.value !== null);
  const missing = breakdown.missingInputs
    .filter((m) => m !== 'labor_rate_per_hour' || result.includeLabor)
    .map((m) => MISSING_LABELS[m]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
      <form className="space-y-5" onSubmit={(e) => e.preventDefault()} noValidate>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="calc-currency" className="text-sm font-medium">
            Currency
          </label>
          <select
            id="calc-currency"
            value={values.currency}
            onChange={(e) => onChange('currency', e.target.value)}
            className={`${inputClass.replace('w-full ', '')} w-28`}
          >
            {CALC_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => update(EXAMPLE_VALUES)}>
              Fill an example
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => update(EMPTY_VALUES)}>
              Clear
            </button>
          </div>
        </div>

        <Group title="filament" note="Price and weight of the whole spool, then how much this print used.">
          <Field label="Spool price" field="spoolPrice" suffix={values.currency} placeholder="20" {...{ values, errors, onChange }} />
          <Field label="Spool weight" field="spoolGrams" suffix="g" placeholder="1000" help="Filament only, not the spool." {...{ values, errors, onChange }} />
          <div className="sm:col-span-2">
            <div role="radiogroup" aria-label="How you know the amount used" className="flex flex-wrap gap-2 text-sm">
              {(
                [
                  ['grams', 'I know the grams'],
                  ['length', 'I only know the length'],
                ] as const
              ).map(([mode, label]) => (
                <label
                  key={mode}
                  className={
                    'cursor-pointer rounded-lg border-[1.5px] px-3 py-1.5 ' +
                    (values.amountMode === mode ? 'border-ink bg-panel font-medium' : 'border-line text-muted')
                  }
                >
                  <input
                    type="radio"
                    name="amountMode"
                    value={mode}
                    checked={values.amountMode === mode}
                    onChange={() => onChange('amountMode', mode)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          {values.amountMode === 'grams' ? (
            <Field label="Filament used" field="grams" suffix="g" placeholder="135.88" help="Your slicer shows it before you print." {...{ values, errors, onChange }} />
          ) : (
            <>
              <Field label="Filament used" field="lengthM" suffix="m" placeholder="45.6" {...{ values, errors, onChange }} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="calc-material" className="block text-sm font-medium">
                    Material
                  </label>
                  <select
                    id="calc-material"
                    value={values.material}
                    onChange={(e) => onChange('material', e.target.value)}
                    className={`${inputClass} mt-1.5`}
                  >
                    {CALC_MATERIALS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="calc-diameter" className="block text-sm font-medium">
                    Diameter
                  </label>
                  <select
                    id="calc-diameter"
                    value={values.diameter}
                    onChange={(e) => onChange('diameter', e.target.value)}
                    className={`${inputClass} mt-1.5`}
                  >
                    <option value="1.75">1.75 mm</option>
                    <option value="2.85">2.85 mm</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </Group>

        <Group title="electricity">
          <Field
            label="Print time"
            field="printTime"
            inputMode="text"
            placeholder="4h 27m"
            help="Like 4h 27m, 4:27 or 267 (minutes)."
            {...{ values, errors, onChange }}
          />
          <Field
            label="Average power draw"
            field="watts"
            suffix="W"
            placeholder="90"
            help="Measured while printing, not the label on the power supply."
            {...{ values, errors, onChange }}
          />
          <Field
            label="Electricity rate"
            field="rate"
            suffix={`${values.currency}/kWh`}
            placeholder="0.13"
            help="From your bill: the price per kWh."
            {...{ values, errors, onChange }}
          />
        </Group>

        <Group title="machine wear" note="What the printer cost, spread over the hours it will print before you replace it.">
          <Field label="Printer price" field="machinePrice" suffix={values.currency} placeholder="400" {...{ values, errors, onChange }} />
          <Field label="Expected life" field="lifeHours" suffix="hours" placeholder="5000" help="Printing hours, not calendar time." {...{ values, errors, onChange }} />
          <Field
            label="Maintenance"
            field="maintPerHour"
            suffix={`${values.currency}/h`}
            placeholder="0.02"
            help="Optional: nozzles, sheets, belts, per printing hour."
            {...{ values, errors, onChange }}
          />
        </Group>

        <Group title="your time and the batch" note="Optional. Leave your time blank to leave labour out.">
          <Field label="Hands-on time" field="laborMinutes" suffix="min" placeholder="10" help="Prep, removal, cleanup: not the print time." {...{ values, errors, onChange }} />
          <Field label="Your hourly rate" field="laborRate" suffix={`${values.currency}/h`} placeholder="20" {...{ values, errors, onChange }} />
          <Field label="Parts on the plate" field="parts" inputMode="numeric" placeholder="1" {...{ values, errors, onChange }} />
          <Field
            label="Success rate"
            field="successRate"
            suffix="%"
            placeholder="90"
            help="How often this kind of print works. Failures still cost filament."
            {...{ values, errors, onChange }}
          />
        </Group>
      </form>

      <aside aria-label="Result" className="lg:sticky lg:top-20">
        <div className="site-panel p-5" aria-live="polite">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-accent-text">; cost of this print</p>
          <ul className="mt-4 space-y-3 text-sm">
            {lines.map((line) => (
              <li key={line.label} className="flex items-baseline gap-3">
                <div className="min-w-0 flex-1">
                  <div className={line.value === null ? 'text-muted' : 'font-medium'}>{line.label}</div>
                  <div className="font-mono text-[11px] text-muted">{line.how ?? `needs ${line.needs}`}</div>
                </div>
                <div className="tabular-nums">{line.value === null ? <span className="text-muted">not included</span> : money(line.value)}</div>
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-line pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{breakdown.costComplete ? 'Total' : 'Total of what you entered'}</span>
              <span className="text-2xl font-semibold tabular-nums">{money(anyCost ? breakdown.totalCost : 0)}</span>
            </div>
            {result.parts > 1 && anyCost ? (
              <div className="mt-1 flex items-baseline justify-between text-sm text-muted">
                <span>Per part ({result.parts} on the plate)</span>
                <span className="tabular-nums">{money(breakdown.costPerUnitProduced)}</span>
              </div>
            ) : null}
            {result.perSuccessfulPrint !== null && anyCost ? (
              <div className="mt-3 rounded-lg bg-accent/15 px-3 py-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">
                    Per {result.parts > 1 ? 'good part' : 'successful print'}, counting failures
                  </span>
                  <span className="font-semibold tabular-nums">
                    {money(result.parts > 1 ? result.perSuccessfulPart : result.perSuccessfulPrint)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">At {values.successRate}% success, the failures are paid for by the prints that work.</p>
              </div>
            ) : null}
            {missing.length > 0 && anyCost ? (
              <p className="mt-3 text-xs text-muted">
                Not included yet: {missing.join(', ')}. Blank is treated as unknown, never as zero.
              </p>
            ) : null}
            {!anyCost ? (
              <p className="mt-3 text-xs text-muted">Fill in any group to start, or try the example.</p>
            ) : null}
            {result.durationMinutes !== null ? (
              <p className="mt-2 font-mono text-[11px] text-muted">; print time read as {formatDuration(result.durationMinutes)}</p>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={copyLink} className="btn btn-secondary btn-sm">
              {copied ? 'Link copied' : 'Copy link to this'}
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-line bg-panel p-5 text-sm">
          <p className="font-semibold">Costing every print, automatically?</p>
          <p className="mt-1 text-muted">
            SpoolStack logs each print from its slicer file and keeps your real success rate. Free to use.
          </p>
          <Link href="/sign-in" className="btn btn-primary btn-sm mt-4">
            Start logging
          </Link>
        </div>
      </aside>
    </div>
  );
}
