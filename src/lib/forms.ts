// Shared form plumbing for Server Actions: FormData -> validated values,
// validation and database errors -> a state the form can render.
//
// The rule that drives every helper here: a BLANK field means "unknown" and
// becomes null, never 0. A blank power rating is not a zero-watt printer, and
// run_cost_breakdown reports null inputs as missing instead of quietly
// costing them at nothing. Turning blanks into zeros here would undo that.

import { z } from 'zod';

// ---------------------------------------------------------------------------
// form state
// ---------------------------------------------------------------------------

export type FieldErrors = Record<string, string>;

export type FormState =
  | { status: 'idle' }
  | { status: 'error'; message: string; fieldErrors: FieldErrors }
  | { status: 'saved'; message: string };

export const idleState: FormState = { status: 'idle' };

export function errorState(message: string, fieldErrors: FieldErrors = {}): FormState {
  return { status: 'error', message, fieldErrors };
}

/** First message per field, in the shape the form components read. */
export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  const out: FieldErrors = {};
  for (const [key, messages] of Object.entries(flat)) {
    if (messages && messages.length > 0) out[key] = messages[0];
  }
  return out;
}

/** FormData to a plain object of strings, for zod to parse. Checkboxes are handled separately. */
export function formObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

/** An unchecked checkbox is absent from FormData entirely, so presence is the signal. */
export function checkbox(formData: FormData, name: string): boolean {
  return formData.get(name) === 'on';
}

// ---------------------------------------------------------------------------
// field schemas
// ---------------------------------------------------------------------------

function blankToNull(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

function trimmed(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function requiredText(label: string, max = 120) {
  return z.preprocess(
    trimmed,
    z
      .string({ error: `${label} is required.` })
      .min(1, `${label} is required.`)
      .max(max, `${label} must be ${max} characters or fewer.`),
  );
}

export function optionalText(label: string, max = 200) {
  return z.preprocess(
    (v) => {
      const b = blankToNull(v);
      return typeof b === 'string' ? b.trim() : b;
    },
    z.string().max(max, `${label} must be ${max} characters or fewer.`).nullable(),
  );
}

interface NumberRule {
  min?: number;
  max?: number;
  /** Strictly greater than min. For things like expected life, where 0 is meaningless. */
  positive?: boolean;
  integer?: boolean;
}

export function optionalNumber(label: string, rule: NumberRule = {}) {
  let schema = z.number({ error: `${label} must be a number.` });
  if (rule.integer) schema = schema.int(`${label} must be a whole number.`);
  if (rule.positive) schema = schema.positive(`${label} must be greater than 0.`);
  if (rule.min !== undefined) schema = schema.min(rule.min, `${label} cannot be below ${rule.min}.`);
  if (rule.max !== undefined) schema = schema.max(rule.max, `${label} cannot be above ${rule.max}.`);

  return z.preprocess((v) => {
    const b = blankToNull(v);
    if (b === null) return null;
    // Accept "1,299.99" as typed from a receipt.
    return Number(String(b).replace(/,/g, ''));
  }, schema.nullable());
}

export function optionalDate(label: string) {
  return z.preprocess(
    blankToNull,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a date.`)
      .nullable(),
  );
}

// ---------------------------------------------------------------------------
// database errors
// ---------------------------------------------------------------------------

interface PostgrestLikeError {
  code?: string;
  message: string;
}

/**
 * Postgres error codes to sentences a person can act on. Anything unmapped
 * falls through with the raw message, which is better than a generic "Something
 * went wrong" when it is you debugging it at the printer.
 */
export function dbErrorMessage(error: PostgrestLikeError, noun: string): string {
  switch (error.code) {
    case '23505':
      return `You already have a ${noun} with that name.`;
    case '23514':
      return `One of the values is outside the allowed range for a ${noun}.`;
    case '23503':
      return `That ${noun} refers to something that no longer exists. Reload and try again.`;
    case '42501':
      return `You do not have permission to change this ${noun}.`;
    default:
      return error.message;
  }
}
