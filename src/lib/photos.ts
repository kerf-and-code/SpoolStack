// Run photos: the rules shared by the browser (upload) and the server
// (validation). Files live in the private "run-photos" Storage bucket at
// <user id>/<run id>/<photo id>.jpg; the first folder is what the Storage
// policies check (db/run_photos.sql).

export const PHOTO_BUCKET = 'run-photos';

/** Longest edge after shrinking. Enough to see stringing and layer lines. */
export const PHOTO_MAX_EDGE = 2048;
export const PHOTO_JPEG_QUALITY = 0.85;
/** Photos per upload batch, and per run, to keep a slip of the thumb cheap. */
export const PHOTO_BATCH_LIMIT = 12;
export const PHOTOS_PER_RUN_LIMIT = 40;

/** Must match run_photos_kind_check in db/run_photos.sql. */
export const PHOTO_KINDS = ['overview', 'closeup', 'first_layer', 'failure', 'other'] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export const PHOTO_KIND_LABELS: Record<PhotoKind, string> = {
  overview: 'Whole print',
  closeup: 'Close-up',
  first_layer: 'First layer',
  failure: 'Where it failed',
  other: 'Other',
};

export function isPhotoKind(v: unknown): v is PhotoKind {
  return typeof v === 'string' && (PHOTO_KINDS as readonly string[]).includes(v);
}

/** The kind to preselect for a new batch, from how the run came out. */
export function defaultPhotoKind(outcome: string | null | undefined): PhotoKind {
  return outcome === 'failure' || outcome === 'partial' || outcome === 'aborted' ? 'failure' : 'overview';
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export function photoPath(userId: string, runId: string, photoId: string): string {
  return `${userId}/${runId}/${photoId}.jpg`;
}

/** True only for a path this user may register against this run. */
export function isOwnPhotoPath(path: string, userId: string, runId: string): boolean {
  const re = new RegExp(`^${UUID}/${UUID}/${UUID}\\.jpg$`, 'i');
  return re.test(path) && path.startsWith(`${userId}/${runId}/`);
}

/** Size to shrink to: the longest edge capped, aspect ratio kept, never enlarged. */
export function fitWithin(width: number, height: number, maxEdge = PHOTO_MAX_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
