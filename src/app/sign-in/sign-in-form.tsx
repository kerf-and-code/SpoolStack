'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string };

export function SignInForm({ next, initialError }: { next: string; initialError?: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>(
    initialError ? { kind: 'error', message: initialError } : { kind: 'idle' },
  );

  const callbackUrl = (origin: string) =>
    `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'sending' });
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl(window.location.origin) },
    });
    if (error) {
      setStatus({ kind: 'error', message: error.message });
      return;
    }
    setStatus({ kind: 'sent', email });
  }

  async function signInWithGoogle() {
    setStatus({ kind: 'sending' });
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl(window.location.origin) },
    });
    if (error) {
      setStatus({ kind: 'error', message: error.message });
    }
    // On success the browser navigates away, so there is nothing to set here.
  }

  if (status.kind === 'sent') {
    return (
      <div className="rounded-lg border border-black/10 dark:border-white/15 p-4 text-sm">
        <p className="font-medium">Check your email.</p>
        <p className="mt-1 opacity-70">
          A sign-in link is on its way to {status.email}. Open it in this same browser,
          the link is tied to this session.
        </p>
      </div>
    );
  }

  const busy = status.kind === 'sending';

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busy}
        className="w-full rounded-lg border border-black/15 dark:border-white/20 px-4 py-2.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
      >
        Continue with Google
      </button>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wide opacity-50">
        <span className="h-px flex-1 bg-current opacity-30" />
        or
        <span className="h-px flex-1 bg-current opacity-30" />
      </div>

      <form onSubmit={sendMagicLink} className="space-y-3">
        <label className="block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-black/15 dark:border-white/20 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-black/40 dark:focus:border-white/50"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-foreground text-background px-4 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {busy ? 'Sending...' : 'Email me a sign-in link'}
        </button>
      </form>

      {status.kind === 'error' ? (
        <p className="text-sm text-red-600 dark:text-red-400">{status.message}</p>
      ) : null}
    </div>
  );
}
