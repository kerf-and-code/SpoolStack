'use client';

import { useEffect } from 'react';

// Last-resort boundary for an error in the root layout itself. It replaces the
// whole document, so it brings its own html and body and cannot rely on
// globals.css or the fonts. Inline styles only, following the OS colour scheme.
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          boxSizing: 'border-box',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
          colorScheme: 'light dark',
          background: 'Canvas',
          color: 'CanvasText',
        }}
      >
        <title>Something went wrong : SpoolStack</title>
        <main style={{ maxWidth: '26rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.4rem', margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ opacity: 0.7, lineHeight: 1.5, margin: '0 0 20px' }}>
            SpoolStack hit an error it could not recover from. Anything you saved before this point is safe.
          </p>
          {error.digest ? (
            <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, opacity: 0.5, margin: '0 0 20px' }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => retry()}
            style={{
              font: 'inherit',
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid currentColor',
              borderRadius: 10,
              padding: '10px 20px',
              background: 'transparent',
              color: 'inherit',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
