// Print durations as people actually type them.
//
// A slicer says "2h 14m", a printer screen says "2:14", and someone doing
// mental arithmetic types "134" or "1.5h". All of those must be accepted, or
// the duration field becomes the slow part of logging a run.
//
// Deliberately NOT built on gcodeParse's hmsToMinutes: that helper reads
// "1.5h" as 5 hours (its pattern captures the digits after the decimal point).
// It is fine for slicer comments, which never use decimals, but people do.

/** 30 days. Past that it is a typo, not a print. */
const MAX_MINUTES = 43_200;

const UNIT_MINUTES: Record<string, number> = { d: 1440, h: 60, m: 1, s: 1 / 60 };

export type DurationResult = { ok: true; minutes: number | null } | { ok: false; message: string };

const FORMAT_HINT = 'Use a form like 2h 14m, 2:14, 1.5h, or 134 (minutes).';

function normaliseUnits(s: string): string {
  return s
    .replace(/days?\b/g, 'd')
    .replace(/(hours?|hrs?)\b/g, 'h')
    .replace(/(minutes?|mins?)\b/g, 'm')
    .replace(/(seconds?|secs?)\b/g, 's');
}

export function parseDurationMinutes(raw: string | null | undefined): DurationResult {
  const s = (raw ?? '').trim().toLowerCase();
  if (s === '') return { ok: true, minutes: null };

  let minutes: number | null = null;

  if (/^\d+(\.\d+)?$/.test(s)) {
    // Bare number: minutes.
    minutes = parseFloat(s);
  } else if (/^\d+:\d{1,2}(:\d{1,2})?$/.test(s)) {
    // h:mm or h:mm:ss, the way printer screens show it.
    const [h, m, sec = 0] = s.split(':').map(Number);
    if (m >= 60 || sec >= 60) return { ok: false, message: 'Minutes and seconds must be under 60.' };
    minutes = h * 60 + m + sec / 60;
  } else {
    // "2h 14m", "1.5h", "2 hours 14 min", "1d 2h". Every character must be
    // consumed by a number-plus-unit token, so "2 apples" or "2h banana" fail
    // rather than half-parsing.
    const n = normaliseUnits(s);
    const token = /(\d+(?:\.\d+)?)\s*([dhms])/g;
    let consumed = '';
    let total = 0;
    let found = false;
    for (const match of n.matchAll(token)) {
      total += parseFloat(match[1]) * UNIT_MINUTES[match[2]];
      consumed += match[0];
      found = true;
    }
    if (found && n.replace(/\s+/g, '') === consumed.replace(/\s+/g, '')) {
      minutes = total;
    }
  }

  if (minutes === null || !Number.isFinite(minutes)) return { ok: false, message: FORMAT_HINT };
  if (minutes <= 0) return { ok: false, message: 'Duration must be more than zero.' };
  if (minutes > MAX_MINUTES) return { ok: false, message: 'That is more than 30 days. Check the number.' };

  return { ok: true, minutes: Math.round(minutes * 100) / 100 };
}

/**
 * For prefilling an edit form: keeps seconds, so opening a run and saving it
 * unchanged does not round 266.98 minutes to 267. Parses back to the same value.
 */
export function formatDurationForInput(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '';
  const totalSec = Math.round(minutes * 60);
  if (totalSec % 60 === 0) return formatDuration(minutes);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h ? `${h}h` : '', m ? `${m}m` : '', `${s}s`].filter(Boolean).join(' ');
}

/** 134 -> "2h 14m". 45 -> "45m". 0.5 -> "30s". */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '';
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
