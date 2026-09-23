'use client';

import Link from 'next/link';
import { useEffect } from 'react';

// Catches a render or data error in any page under /app. The app shell (nav,
// Log run, Sign out) stays on screen, because this boundary sits inside the
// /app layout.
//
// In production Next replaces the message of a server-side error with a
// generic one and passes only a digest. The digest matches the entry in the
// Vercel function logs, so it is shown for looking the error up there.
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm opacity-70">
        This page failed to load. Anything you saved before this point is safe. Try again, and if it keeps
        happening, a connection problem or a bug is the likely cause.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-xs opacity-50">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background"
        >
          Try again
        </button>
        <Link
          href="/app"
          className="rounded-md border border-black/15 px-3 py-1.5 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
