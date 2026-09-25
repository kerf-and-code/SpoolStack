// SpoolStack service worker.
//
// Deliberately minimal. It does exactly one thing: when a full page load fails
// because the device is offline, it shows /offline.html instead of the
// browser's error page. It caches nothing else and never stores a page, so no
// signed-in content can be served stale or to the wrong person.
//
// Not intercepted, left entirely to the browser:
//   * anything that is not a GET navigation (so sign-out POSTs and server
//     actions are untouched)
//   * client-side navigations, which Next does with fetch(), not navigations
//   * every asset, API call and Supabase request
//
// Bump VERSION whenever offline.html or the icon it shows changes.

const VERSION = 'v3';
const CACHE = `spoolstack-offline-${VERSION}`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, '/icons/icon-192.png']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith('spoolstack-') && k !== CACHE).map((k) => caches.delete(k)),
      );
      // Lets the page request start in parallel with the worker booting.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.mode !== 'navigate' || request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      try {
        const preloaded = await event.preloadResponse;
        if (preloaded) return preloaded;
        return await fetch(request);
      } catch {
        const cache = await caches.open(CACHE);
        const offline = await cache.match(OFFLINE_URL);
        return offline || Response.error();
      }
    })(),
  );
});
