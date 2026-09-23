// Display formatting. Kept separate from forms.ts because it is used by both
// server pages and client components.

export function formatMoney(
  value: number | null | undefined,
  currency: string,
  maxFractionDigits = 2,
): string {
  if (value === null || value === undefined) return '';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: Math.max(2, maxFractionDigits),
    }).format(value);
  } catch {
    // An unrecognised currency code should not take the page down.
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function formatNumber(value: number | null | undefined, maxFractionDigits = 2): string {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: maxFractionDigits }).format(value);
}

/** For defaultValue on inputs: null becomes an empty field, numbers stay unformatted. */
export function inputValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value);
}
