// Titles for retry runs: "<parent title> (retry N)".
//
// A retry used to copy the failed run's title unchanged, so the runs list
// filled with identical names and the wrong run got opened and deleted (UX
// critic round 1, finding 4). Numbering follows the highest "(retry N)"
// already used for the same base title, so retrying a retry, or retrying the
// original twice, never repeats a number.
//
// Pure, so it is testable without a database: the caller looks up the titles
// already in use and passes them in.

/** The run form's title limit (optionalText('Title', 120) in runs/actions.ts). */
export const TITLE_MAX = 120;

const SUFFIX = /\s*\(retry (\d+)\)\s*$/i;

/** "Tankard (retry 2)" to "Tankard"; a title without the suffix is returned trimmed. */
export function retryBase(title: string): string {
  return title.replace(SUFFIX, '').trim();
}

/** The N in "(retry N)", or 0 when the title has none. */
export function retryNumber(title: string): number {
  const m = SUFFIX.exec(title);
  return m ? Number(m[1]) : 0;
}

/**
 * A LIKE pattern matching "<base> (retry <anything>)", with LIKE's own
 * wildcards in the base escaped so a title such as "50% infill" matches only
 * itself.
 */
export function retryTitlePattern(base: string): string {
  return `${base.replace(/[\\%_]/g, (c) => `\\${c}`)} (retry %)`;
}

/**
 * The title for a new retry of a run titled `parentTitle`, given titles that
 * already exist for the same base. Empty when the parent has nothing to build
 * on. Never longer than TITLE_MAX: the base is shortened, the suffix kept.
 */
export function nextRetryTitle(parentTitle: string, existing: readonly string[]): string {
  const base = retryBase(parentTitle);
  if (!base) return '';
  let highest = retryNumber(parentTitle);
  for (const t of existing) {
    if (retryBase(t).toLowerCase() === base.toLowerCase()) highest = Math.max(highest, retryNumber(t));
  }
  const suffix = ` (retry ${highest + 1})`;
  const room = TITLE_MAX - suffix.length;
  return `${base.length > room ? base.slice(0, room).trimEnd() : base}${suffix}`;
}
