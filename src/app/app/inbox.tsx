'use client';

// "Did it print?": files the slicer uploader sent, waiting for an outcome.
// The whole point of Stage 1 is that logging a print is confirming it, not
// typing it, so the common case (it worked, and the printer and filament are
// certain) is one tap.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { LocalTime } from '@/components/local-time';
import { formatDuration } from '@/lib/duration';
import { formatNumber } from '@/lib/format';
import { dismissPending, logPendingWorked } from './inbox-actions';

export interface InboxItem {
  id: string;
  fileName: string;
  printerModel: string | null;
  durationMinutes: number | null;
  materialG: number | null;
  slicedAt: string;
  /** "Bambu A1, PLA Basic Black" when both are certain, else null. */
  setupLabel: string | null;
}

interface Done {
  id: string;
  title: string;
  runId: string;
}

const btn =
  'rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50 border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10';

export function Inbox({ items }: { items: InboxItem[] }) {
  const [done, setDone] = useState<Done[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const visible = items.filter((i) => !hidden.has(i.id) && !done.some((d) => d.id === i.id));
  if (visible.length === 0 && done.length === 0) return null;

  function worked(item: InboxItem) {
    setBusy(item.id);
    setErrors((e) => ({ ...e, [item.id]: '' }));
    startTransition(async () => {
      const r = await logPendingWorked(item.id);
      setBusy(null);
      if (r.ok) setDone((d) => [{ id: item.id, title: r.title, runId: r.runId }, ...d]);
      else if (r.openForm) router.push(`/app/runs/new?pending=${item.id}&outcome=success`);
      else setErrors((e) => ({ ...e, [item.id]: r.message }));
    });
  }

  function notPrinted(item: InboxItem) {
    setBusy(item.id);
    startTransition(async () => {
      const r = await dismissPending(item.id);
      setBusy(null);
      if (r.ok) setHidden((h) => new Set(h).add(item.id));
      else setErrors((e) => ({ ...e, [item.id]: r.message ?? 'Could not set it aside.' }));
    });
  }

  return (
    <section className="rounded-lg border-2 border-foreground/80 p-5" aria-labelledby="inbox-heading">
      <h2 id="inbox-heading" className="font-semibold">
        Did it print?
      </h2>
      <p className="mt-1 text-sm opacity-65">Sent by your slicer. Tap how it went; everything else is already filled in.</p>

      {done.length > 0 ? (
        <ul className="mt-4 space-y-1.5 text-sm" aria-live="polite">
          {done.map((d) => (
            <li key={d.id} className="rounded-md bg-emerald-500/10 px-3 py-2">
              Logged <span className="font-medium">{d.title}</span>.{' '}
              <Link href={`/app/runs/${d.runId}#photos`} className="underline underline-offset-2">
                Add a photo
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="mt-4 divide-y divide-black/10 dark:divide-white/15">
        {visible.map((item) => {
          const facts = [
            item.durationMinutes !== null ? formatDuration(item.durationMinutes) : null,
            item.materialG !== null ? `${formatNumber(item.materialG, 1)} g` : null,
            item.setupLabel ?? item.printerModel,
          ].filter(Boolean);
          const isBusy = busy === item.id;
          return (
            <li key={item.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="min-w-0 break-words font-medium">{item.fileName}</span>
                <span className="text-xs opacity-60">
                  sliced <LocalTime iso={item.slicedAt} />
                </span>
              </div>
              {facts.length > 0 ? <p className="mt-0.5 text-sm opacity-70">{facts.join(' · ')}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {item.setupLabel ? (
                  <button
                    type="button"
                    onClick={() => worked(item)}
                    disabled={isBusy}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {isBusy ? 'Logging...' : 'Worked'}
                  </button>
                ) : (
                  <Link
                    href={`/app/runs/new?pending=${item.id}&outcome=success`}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Worked
                  </Link>
                )}
                <Link href={`/app/runs/new?pending=${item.id}&outcome=failure`} className={btn}>
                  Failed
                </Link>
                <Link href={`/app/runs/new?pending=${item.id}`} className={btn}>
                  Partly, or edit first
                </Link>
                <button type="button" onClick={() => notPrinted(item)} disabled={isBusy} className={`${btn} opacity-70`}>
                  Didn&rsquo;t print
                </button>
              </div>
              {!item.setupLabel ? (
                <p className="mt-2 text-xs opacity-60">
                  Opens the form so you can pick the {item.printerModel ? 'machine or material' : 'machine and material'}.
                </p>
              ) : null}
              {errors[item.id] ? (
                <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {errors[item.id]}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
