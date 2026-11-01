'use client';

// The run delete button. Its confirm names the run (title, outcome, date) and
// says what goes with it, so a user picking between runs with similar titles
// can tell which one they are about to remove.
//
// Built in the browser, not in the page: the page renders on the server in
// UTC, which would put an evening print on the wrong day. The message is only
// read inside the click handler, after hydration, so the date is always the
// viewer's local one and nothing in the markup can mismatch.
//
// What it says matches what deleteRun does: the run's rows and photo files
// are removed; later runs that retry it are kept, with retry_of_run_id set to
// null (runs_retry_of_run_id_fkey is ON DELETE SET NULL).

import { ConfirmSubmit } from '@/components/confirm-submit';

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function DeleteRunButton({
  title,
  outcomeLabel,
  finishedIso,
  photoCount,
  retryCount,
  className,
}: {
  title: string;
  outcomeLabel: string;
  finishedIso: string;
  photoCount: number;
  retryCount: number;
  className?: string;
}) {
  const d = new Date(finishedIso);
  const date = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  });
  const what = photoCount > 0 ? ` and its ${plural(photoCount, 'photo', 'photos')}` : '';
  const retries =
    retryCount > 0
      ? ` ${plural(retryCount, 'retry run is', 'retry runs are')} kept but will no longer show what ${retryCount === 1 ? 'it' : 'they'} retried.`
      : '';
  const message = `Delete "${title}" (${outcomeLabel}, ${date})${what}?${retries} This cannot be undone.`;

  return (
    <ConfirmSubmit message={message} className={className}>
      Delete run
    </ConfirmSubmit>
  );
}
