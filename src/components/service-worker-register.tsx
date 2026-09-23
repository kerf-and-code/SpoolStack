'use client';

import { useEffect } from 'react';

// Registers /sw.js in production only. In development a service worker
// survives reloads and makes changes look like they did not deploy.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      // Registration failing only means no offline page. Nothing to surface.
    });
  }, []);
  return null;
}
