'use client';

// One photo on a run: the image, what kind of shot it is, and which defect
// it shows. Those two labels are what later photo diagnosis is trained and
// tested on, so they are one tap each and save as soon as they change.

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { PHOTO_KIND_LABELS, PHOTO_KINDS, type PhotoKind } from '@/lib/photos';
import { deleteRunPhoto, updateRunPhoto } from '../photo-actions';

export interface DefectOption {
  id: number;
  label: string;
  onRun: boolean;
}

const selectClass =
  'w-full min-w-0 rounded-md border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20';

export function PhotoCard({
  id,
  url,
  kind,
  defectTypeId,
  defects,
  index,
}: {
  id: string;
  url: string | null;
  kind: PhotoKind;
  defectTypeId: number | null;
  defects: DefectOption[];
  index: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(changes: { kind?: string; defectTypeId?: number | null }) {
    setError(null);
    startTransition(async () => {
      const result = await updateRunPhoto(id, changes);
      if (!result.ok) setError(result.message);
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm('Delete this photo? This cannot be undone.')) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteRunPhoto(id);
      if (!result.ok) setError(result.message);
      router.refresh();
    });
  }

  const onRun = defects.filter((d) => d.onRun);
  const others = defects.filter((d) => !d.onRun);

  return (
    <figure className={'overflow-hidden rounded-lg border border-black/10 dark:border-white/15 ' + (pending ? 'opacity-60' : '')}>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="block bg-black/5 dark:bg-white/5">
          {/* A signed, expiring URL from private Storage: next/image would cache it past its expiry. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`Photo ${index + 1} of this run`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
        </a>
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-black/5 text-xs opacity-60 dark:bg-white/5">
          Image unavailable
        </div>
      )}
      <figcaption className="space-y-1.5 p-2">
        <label className="block">
          <span className="sr-only">Photo type</span>
          <select
            className={selectClass}
            value={kind}
            disabled={pending}
            onChange={(e) => save({ kind: e.target.value })}
          >
            {PHOTO_KINDS.map((k) => (
              <option key={k} value={k}>
                {PHOTO_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Defect shown</span>
          <select
            className={selectClass}
            value={defectTypeId ?? ''}
            disabled={pending}
            onChange={(e) => save({ defectTypeId: e.target.value === '' ? null : Number(e.target.value) })}
          >
            <option value="">No defect shown</option>
            {onRun.length > 0 ? (
              <optgroup label="Logged on this run">
                {onRun.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label={onRun.length > 0 ? 'Other defects' : 'Defects'}>
              {others.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <div className="flex items-center justify-between">
          {error ? <span className="text-xs text-red-700 dark:text-red-400">{error}</span> : <span />}
          <button type="button" onClick={remove} disabled={pending} className="text-xs opacity-60 hover:opacity-100 hover:underline">
            Delete
          </button>
        </div>
      </figcaption>
    </figure>
  );
}
