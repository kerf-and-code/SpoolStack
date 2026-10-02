'use client';

// Creates an upload token and shows it once, with the exact setup command
// to paste. Closing or reloading the page loses it, by design: only its hash
// is stored.

import { useState, useTransition } from 'react';
import { createUploadToken } from './actions';

const input =
  'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-base sm:text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50';

export function TokenCreator() {
  const [name, setName] = useState('My PC');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const command = token ? `python spoolstack_upload.py --setup ${token}` : '';

  function create() {
    setError(null);
    startTransition(async () => {
      const r = await createUploadToken(name);
      if (r.ok) setToken(r.token);
      else setError(r.message);
    });
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      setCopied(null);
    }
  }

  if (token) {
    return (
      <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
        <p className="font-semibold">Your token for &ldquo;{name}&rdquo;. Copy it now: it is shown only once.</p>
        <p className="mt-3 text-xs opacity-70">Run this in the folder where you saved the script:</p>
        <pre className="mt-1 overflow-x-auto rounded bg-background p-3 font-mono text-xs">{command}</pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copy(command, 'command')}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            {copied === 'command' ? 'Copied' : 'Copy command'}
          </button>
          <button
            type="button"
            onClick={() => copy(token, 'token')}
            className="rounded-lg border border-black/20 px-4 py-2 text-sm dark:border-white/25"
          >
            {copied === 'token' ? 'Copied' : 'Copy token only'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <label htmlFor="token-name" className="mb-1.5 block text-sm font-medium">
          Which computer is this for?
        </label>
        <input
          id="token-name"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          className={input}
        />
      </div>
      <button
        type="button"
        onClick={create}
        disabled={pending}
        className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
      >
        {pending ? 'Creating...' : 'Create token'}
      </button>
      {error ? (
        <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
