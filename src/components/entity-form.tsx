'use client';

// One data-driven form for every setup entity (machines, materials, projects,
// settings). The server page describes the fields as plain data, this
// component renders them. Same idea as the run form driven by parameter_defs:
// adding a field is a config change, not new JSX.
//
// Submission uses onSubmit + startTransition rather than <form action>.
// React 19 automatically RESETS a form after an action passed to `action`
// completes, which would wipe everything the user typed whenever validation
// fails. Dispatching from onSubmit opts out of that reset, so a rejected form
// comes back exactly as it was typed, with the errors beside the fields.

import Link from 'next/link';
import { startTransition, useActionState, useState } from 'react';
import type { FormState } from '@/lib/forms';
import { idleState } from '@/lib/forms';
import { formatMoney } from '@/lib/format';

export type FieldKind = 'text' | 'number' | 'textarea' | 'select' | 'date' | 'checkbox';

export interface FieldConfig {
  name: string;
  label: string;
  kind: FieldKind;
  /** For checkboxes: 'on' when checked, '' when not. */
  defaultValue?: string;
  required?: boolean;
  help?: string;
  placeholder?: string;
  /** Shown after the input: 'W', 'hours', 'g'. */
  suffix?: string;
  options?: { value: string; label: string }[];
  /** Tags the field as an input to run_cost_breakdown. */
  costing?: boolean;
  /** Free-text suggestions, rendered as a <datalist>. */
  suggestions?: string[];
  maxLength?: number;
}

export interface FieldGroup {
  title: string;
  description?: string;
  fields: FieldConfig[];
}

/** Live "package cost / package qty" readout for the materials form. */
export interface DerivedCost {
  numerator: string;
  denominator: string;
  unitField: string;
  currency: string;
}

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function EntityForm({
  action,
  groups,
  submitLabel,
  cancelHref,
  derived,
}: {
  action: Action;
  groups: FieldGroup[];
  submitLabel: string;
  cancelHref?: string;
  derived?: DerivedCost;
}) {
  const [state, dispatch, pending] = useActionState(action, idleState);

  // Only tracked for the derived readout; the inputs themselves stay uncontrolled.
  const initialValues: Record<string, string> = {};
  for (const group of groups) {
    for (const field of group.fields) initialValues[field.name] = field.defaultValue ?? '';
  }
  const [values, setValues] = useState(initialValues);

  const fieldErrors = state.status === 'error' ? state.fieldErrors : {};

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  function onChange(event: React.FormEvent<HTMLFormElement>) {
    const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (!target.name) return;
    setValues((prev) => ({ ...prev, [target.name]: target.value }));
  }

  return (
    <form onSubmit={onSubmit} onChange={onChange} className="space-y-10" noValidate>
      {groups.map((group) => (
        <fieldset key={group.title} className="space-y-5">
          <div>
            <legend className="text-base font-semibold">{group.title}</legend>
            {group.description ? (
              <p className="mt-1 text-sm opacity-65">{group.description}</p>
            ) : null}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {group.fields.map((field) => (
              <Field key={field.name} field={field} error={fieldErrors[field.name]} />
            ))}
          </div>
          {derived && group.fields.some((f) => f.name === derived.numerator) ? (
            <DerivedReadout derived={derived} values={values} />
          ) : null}
        </fieldset>
      ))}

      {state.status === 'error' ? (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
          {state.message}
        </p>
      ) : null}
      {state.status === 'saved' ? (
        <p role="status" className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm">
          {state.message}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50"
        >
          {pending ? 'Saving...' : submitLabel}
        </button>
        {cancelHref ? (
          <Link href={cancelHref} className="text-sm opacity-70 hover:opacity-100">
            Cancel
          </Link>
        ) : null}
      </div>
    </form>
  );
}

const inputClass =
  'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none ' +
  'focus:border-black/40 dark:border-white/20 dark:focus:border-white/50 ' +
  'aria-[invalid=true]:border-red-500';

function Field({ field, error }: { field: FieldConfig; error?: string }) {
  const id = `f-${field.name}`;
  const helpId = field.help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;
  const wide = field.kind === 'textarea';

  if (field.kind === 'checkbox') {
    return (
      <div className="sm:col-span-2">
        <label htmlFor={id} className="flex items-start gap-3 text-sm">
          <input
            id={id}
            name={field.name}
            type="checkbox"
            defaultChecked={field.defaultValue === 'on'}
            aria-describedby={describedBy}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="font-medium">{field.label}</span>
            {field.help ? (
              <span id={helpId} className="mt-0.5 block opacity-65">
                {field.help}
              </span>
            ) : null}
          </span>
        </label>
        {error ? (
          <p id={errorId} className="mt-1 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const common = {
    id,
    name: field.name,
    defaultValue: field.defaultValue ?? '',
    required: field.required,
    placeholder: field.placeholder,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    className: inputClass,
  };

  let control: React.ReactNode;
  if (field.kind === 'textarea') {
    control = <textarea {...common} rows={3} maxLength={field.maxLength} />;
  } else if (field.kind === 'select') {
    control = (
      <select {...common}>
        {(field.options ?? []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (field.kind === 'date') {
    control = <input {...common} type="date" />;
  } else if (field.kind === 'number') {
    // type="text" + inputMode, not type="number": number inputs reject "1,299.99"
    // pasted from a receipt and silently submit an empty string instead.
    control = <input {...common} type="text" inputMode="decimal" autoComplete="off" />;
  } else {
    const listId = field.suggestions ? `${id}-list` : undefined;
    control = (
      <>
        <input {...common} type="text" list={listId} maxLength={field.maxLength} />
        {field.suggestions ? (
          <datalist id={listId}>
            {field.suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        ) : null}
      </>
    );
  }

  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <div className="mb-1.5 flex items-center gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {field.label}
          {field.required ? <span className="opacity-50"> *</span> : null}
        </label>
        {field.costing ? (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium">
            used for costing
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {control}
        {field.suffix ? <span className="shrink-0 text-sm opacity-60">{field.suffix}</span> : null}
      </div>
      {field.help ? (
        <p id={helpId} className="mt-1 text-xs opacity-60">
          {field.help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function DerivedReadout({ derived, values }: { derived: DerivedCost; values: Record<string, string> }) {
  const num = parseFloat((values[derived.numerator] ?? '').replace(/,/g, ''));
  const den = parseFloat((values[derived.denominator] ?? '').replace(/,/g, ''));
  const unit = values[derived.unitField] || 'unit';
  const ok = Number.isFinite(num) && Number.isFinite(den) && den > 0;

  return (
    <p className="rounded-md bg-black/5 px-3 py-2 text-sm dark:bg-white/10">
      {ok ? (
        <>
          Works out to <span className="font-semibold">{formatMoney(num / den, derived.currency, 4)}</span> per{' '}
          {unit}. This is saved as the cost per unit.
        </>
      ) : (
        <span className="opacity-70">
          Enter the package cost and quantity and the cost per unit is worked out for you. Or leave both
          blank and enter the cost per unit yourself.
        </span>
      )}
    </p>
  );
}
