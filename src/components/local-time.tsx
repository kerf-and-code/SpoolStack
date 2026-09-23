'use client';

import { useSyncExternalStore } from 'react';

// Renders a timestamp in the VIEWER's timezone. Server components render in
// the server's zone (UTC on Vercel), which puts an evening print on the wrong
// day for anyone in Seattle. Until hydration it shows the UTC date only, so
// server and client markup agree and there is no hydration mismatch.
export function LocalTime({ iso, withTime = true }: { iso: string; withTime?: boolean }) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const d = new Date(iso);
  if (!mounted) return <time dateTime={iso}>{iso.slice(0, 10)}</time>;
  const text = d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
  return <time dateTime={iso}>{text}</time>;
}
