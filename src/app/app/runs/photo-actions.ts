'use server';

// Server side of run photos. The browser uploads the file straight to the
// private Storage bucket (Storage policies limit it to the user's own folder
// and own runs), then calls addRunPhoto to record it. Every action proves the
// user and re-checks ownership; RLS on run_photos is the second lock.

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { PHOTO_BUCKET, PHOTOS_PER_RUN_LIMIT, isOwnPhotoPath, isPhotoKind } from '@/lib/photos';

export type PhotoActionResult = { ok: true } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const posInt = (v: unknown, max: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= max ? v : null;

export async function addRunPhoto(input: {
  runId: string;
  path: string;
  kind: string;
  width: number;
  height: number;
  bytes: number;
}): Promise<PhotoActionResult> {
  const { supabase, userId } = await requireUser();
  if (!UUID.test(input.runId)) return { ok: false, message: 'That run no longer exists.' };
  if (!isOwnPhotoPath(input.path, userId, input.runId)) return { ok: false, message: 'The photo was stored in the wrong place.' };
  if (!isPhotoKind(input.kind)) return { ok: false, message: 'Unknown photo type.' };

  const { data: run } = await supabase.from('runs').select('id').eq('id', input.runId).maybeSingle();
  if (!run) return { ok: false, message: 'That run no longer exists.' };

  const { count } = await supabase
    .from('run_photos')
    .select('id', { count: 'exact', head: true })
    .eq('run_id', input.runId);
  if ((count ?? 0) >= PHOTOS_PER_RUN_LIMIT) {
    return { ok: false, message: `A run can hold ${PHOTOS_PER_RUN_LIMIT} photos. Delete one to add another.` };
  }

  const { error } = await supabase.from('run_photos').insert({
    run_id: input.runId,
    user_id: userId,
    storage_path: input.path,
    kind: input.kind,
    width: posInt(input.width, 20_000),
    height: posInt(input.height, 20_000),
    bytes: posInt(input.bytes, 10_485_760),
  });
  if (error) return { ok: false, message: `The photo uploaded but was not recorded. ${error.message}` };

  revalidatePath(`/app/runs/${input.runId}`);
  return { ok: true };
}

export async function updateRunPhoto(
  photoId: string,
  changes: { kind?: string; defectTypeId?: number | null; caption?: string | null },
): Promise<PhotoActionResult> {
  const { supabase } = await requireUser();
  if (!UUID.test(photoId)) return { ok: false, message: 'That photo no longer exists.' };

  const patch: { kind?: string; defect_type_id?: number | null; caption?: string | null } = {};
  if (changes.kind !== undefined) {
    if (!isPhotoKind(changes.kind)) return { ok: false, message: 'Unknown photo type.' };
    patch.kind = changes.kind;
  }
  if (changes.defectTypeId !== undefined) {
    if (changes.defectTypeId !== null && !(Number.isInteger(changes.defectTypeId) && changes.defectTypeId > 0)) {
      return { ok: false, message: 'Unknown defect.' };
    }
    patch.defect_type_id = changes.defectTypeId;
  }
  if (changes.caption !== undefined) {
    const c = (changes.caption ?? '').trim();
    if (c.length > 300) return { ok: false, message: 'Keep the note under 300 characters.' };
    patch.caption = c === '' ? null : c;
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  const { data, error } = await supabase.from('run_photos').update(patch).eq('id', photoId).select('run_id');
  if (error) return { ok: false, message: error.message };
  // PostgREST answers 200 for an update that matched nothing (RLS included).
  if (!data || data.length === 0) return { ok: false, message: 'That photo no longer exists.' };

  revalidatePath(`/app/runs/${data[0].run_id}`);
  return { ok: true };
}

/**
 * The row goes first: it is the record of truth. If removing the file then
 * fails, the leftover file is invisible and harmless, where a row pointing
 * at a missing file would show as a broken photo.
 */
export async function deleteRunPhoto(photoId: string): Promise<PhotoActionResult> {
  const { supabase } = await requireUser();
  if (!UUID.test(photoId)) return { ok: false, message: 'That photo no longer exists.' };

  const { data, error } = await supabase
    .from('run_photos')
    .delete()
    .eq('id', photoId)
    .select('run_id, storage_path');
  if (error) return { ok: false, message: error.message };
  if (!data || data.length === 0) return { ok: false, message: 'That photo no longer exists.' };

  const { error: storageError } = await supabase.storage.from(PHOTO_BUCKET).remove([data[0].storage_path]);
  if (storageError) console.error('run photo file not removed', data[0].storage_path, storageError.message);

  revalidatePath(`/app/runs/${data[0].run_id}`);
  return { ok: true };
}

/** For the browser to undo an upload whose record could not be written. */
export async function discardUploadedPhoto(runId: string, path: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  if (!UUID.test(runId) || !isOwnPhotoPath(path, userId, runId)) return;
  await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}
