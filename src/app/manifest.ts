import type { MetadataRoute } from 'next';
import { BRAND, SITE_DESCRIPTION, SITE_NAME } from '@/lib/site';

// Served at /manifest.webmanifest and linked automatically. A valid manifest
// over HTTPS is what makes the app installable; per the Next 16 PWA guide no
// offline support is required for the install prompt.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    // Installed, it opens straight to the log; /app sends signed-out users to sign in.
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: BRAND.ink,
    theme_color: BRAND.ink,
    categories: ['productivity', 'utilities'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Log a run',
        short_name: 'Log run',
        url: '/app/runs/new',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      { name: 'Runs', url: '/app/runs', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
    ],
  };
}
