'use client';

// The diagnosis-training opt-in. Off by default, saved the moment it changes.
// The words here and on the privacy page say the same thing; change both
// together.

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { saveContribute } from './actions';

export function ContributeToggle({ initial, changedAtIso }: { initial: boolean; changedAtIso: string | null }) {
  const [on, setOn] = useState(initial);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    setMessage(null);
    startTransition(async () => {
      const result = await saveContribute(next);
      if (result.ok) {
        setOn(result.on);
        setMessage({
          tone: 'ok',
          text: result.on
            ? 'Thank you. Your photos, labels and settings will be included in the next training set.'
            : 'Off. Your data will be left out of every training set built from now on.',
        });
      } else {
        setMessage({ tone: 'error', text: result.message });
      }
    });
  }

  return (
    <section id="contribute" className="mt-12 border-t border-black/10 pt-6 dark:border-white/15">
      <h2 className="text-base font-semibold">Help build print diagnosis</h2>
      <p className="mt-2 text-sm opacity-75">
        SpoolStack is learning to spot print defects from a photo, on your phone, with no AI service involved. It
        learns from real prints. If you switch this on, the photos you add to runs, the defect labels you give them
        and the settings of those runs can be used to train and test that model.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm opacity-75">
        <li>Never published, sold or shared. The model that ships contains no photos.</li>
        <li>Off by default, and you can switch it off at any time.</li>
        <li>
          Off means left out of every training set built after that. A model already trained is not rebuilt just to
          remove one account.
        </li>
      </ul>
      <label className="mt-4 flex items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          checked={on}
          disabled={pending}
          onChange={(e) => change(e.target.checked)}
          className="h-5 w-5"
        />
        Share my photos, labels and run settings to train diagnosis
      </label>
      {pending ? <p className="mt-2 text-xs opacity-60">Saving...</p> : null}
      {message ? (
        <p
          role="status"
          className={'mt-2 text-sm ' + (message.tone === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}
        >
          {message.text}
        </p>
      ) : changedAtIso ? (
        <p className="mt-2 text-xs opacity-60">Last changed {changedAtIso.slice(0, 10)}.</p>
      ) : null}
      <p className="mt-3 text-xs opacity-60">
        Details in the{' '}
        <Link href="/privacy#training" className="underline underline-offset-2">
          privacy page
        </Link>
        .
      </p>
    </section>
  );
}
