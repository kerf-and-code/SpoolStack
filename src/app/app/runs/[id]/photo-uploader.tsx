'use client';

// Add photos to a run, from the camera or the photo library. Each file is
// shrunk on the device, uploaded straight to the private Storage bucket,
// then recorded with addRunPhoto. One at a time, so a phone on slow wifi at
// the printer shows real progress and a failure names the photo it hit.

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { shrinkImage } from '@/lib/image-shrink';
import {
  PHOTO_BATCH_LIMIT,
  PHOTO_BUCKET,
  PHOTO_KIND_LABELS,
  PHOTO_KINDS,
  photoPath,
  type PhotoKind,
} from '@/lib/photos';
import { createClient } from '@/lib/supabase/client';
import { addRunPhoto, discardUploadedPhoto } from '../photo-actions';

type Status = { kind: 'idle' } | { kind: 'working'; done: number; total: number } | { kind: 'done'; added: number; errors: string[] };

export function PhotoUploader({
  runId,
  userId,
  defaultKind,
  remaining,
}: {
  runId: string;
  userId: string;
  defaultKind: PhotoKind;
  /** How many more photos this run can take. */
  remaining: number;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<PhotoKind>(defaultKind);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const busy = status.kind === 'working';

  async function upload(fileList: FileList | null) {
    const files = Array.from(fileList ?? []).slice(0, Math.min(PHOTO_BATCH_LIMIT, remaining));
    if (files.length === 0) return;
    const supabase = createClient();
    const errors: string[] = [];
    let added = 0;
    setStatus({ kind: 'working', done: 0, total: files.length });

    for (const [i, file] of files.entries()) {
      try {
        const { blob, width, height } = await shrinkImage(file);
        const path = photoPath(userId, runId, crypto.randomUUID());
        const { error: uploadError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (uploadError) throw new Error(`${file.name}: ${uploadError.message}`);

        const result = await addRunPhoto({ runId, path, kind, width, height, bytes: blob.size });
        if (!result.ok) {
          await discardUploadedPhoto(runId, path);
          throw new Error(`${file.name}: ${result.message}`);
        }
        added += 1;
      } catch (e) {
        const message = e instanceof Error ? e.message : `${file.name} failed.`;
        // fetch() failing outright means no connection, not a bad photo.
        errors.push(/failed to fetch|network/i.test(message) ? `${file.name}: could not reach the server. Check the connection and try again.` : message);
      }
      setStatus({ kind: 'working', done: i + 1, total: files.length });
    }

    setStatus({ kind: 'done', added, errors });
    if (cameraRef.current) cameraRef.current.value = '';
    if (libraryRef.current) libraryRef.current.value = '';
    router.refresh();
  }

  if (remaining <= 0) {
    return <p className="text-sm opacity-60">This run has the maximum number of photos. Delete one to add another.</p>;
  }

  return (
    <div className="rounded-lg border border-dashed border-black/20 p-4 dark:border-white/25">
      <fieldset disabled={busy}>
        <legend className="text-sm font-medium">What are these photos of?</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PHOTO_KINDS.map((k) => (
            <label
              key={k}
              className={
                'cursor-pointer rounded-full border px-3 py-1 text-sm ' +
                (kind === k
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10')
              }
            >
              <input
                type="radio"
                name="photo-kind"
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
                className="sr-only"
              />
              {PHOTO_KIND_LABELS[k]}
            </label>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {/* capture opens the camera directly on phones; on desktop it is ignored. */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            id={`camera-${runId}`}
            onChange={(e) => upload(e.currentTarget.files)}
          />
          <label
            htmlFor={`camera-${runId}`}
            className="cursor-pointer rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Take photo
          </label>
          <input
            ref={libraryRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            id={`library-${runId}`}
            onChange={(e) => upload(e.currentTarget.files)}
          />
          <label
            htmlFor={`library-${runId}`}
            className="cursor-pointer rounded-lg border border-black/15 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Choose photos
          </label>
        </div>
      </fieldset>

      <div aria-live="polite" className="mt-3 text-sm">
        {status.kind === 'working' ? (
          <p className="opacity-70">
            Uploading {Math.min(status.done + 1, status.total)} of {status.total}...
          </p>
        ) : null}
        {status.kind === 'done' ? (
          <>
            {status.added > 0 ? (
              <p className="opacity-70">
                {status.added === 1 ? 'Photo added.' : `${status.added} photos added.`} Tag any defect each one shows below.
              </p>
            ) : null}
            {status.errors.length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-red-700 dark:text-red-400">
                {status.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
        {status.kind === 'idle' ? (
          <p className="text-xs opacity-55">
            Photos are shrunk on your device and stored privately. Location data is removed before upload.
          </p>
        ) : null}
      </div>
    </div>
  );
}
