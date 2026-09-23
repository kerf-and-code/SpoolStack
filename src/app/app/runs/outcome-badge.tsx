const OUTCOME_BADGE: Record<string, { label: string; cls: string }> = {
  success: { label: 'Success', cls: 'border-emerald-500/40 bg-emerald-500/10' },
  partial: { label: 'Partial', cls: 'border-amber-500/40 bg-amber-500/10' },
  failure: { label: 'Failed', cls: 'border-red-500/40 bg-red-500/10' },
  aborted: { label: 'Aborted', cls: 'border-neutral-500/40 bg-neutral-500/10' },
};

export function OutcomeBadge({ outcome }: { outcome: string }) {
  const badge = OUTCOME_BADGE[outcome] ?? { label: outcome, cls: '' };
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${badge.cls}`}>{badge.label}</span>;
}

export const OUTCOME_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(OUTCOME_BADGE).map(([k, v]) => [k, v.label]),
);
