// Next 16 renamed the `middleware` file convention to `proxy`. Same job:
// runs before every matched request. Here it refreshes the Supabase session
// and guards /app. The logic lives in src/lib/supabase/middleware.ts.
//
// Proxy runs on the Node.js runtime by default in Next 16, and setting a
// `runtime` export in this file throws, so there is deliberately none.

import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Every path except static assets, image files and the public PWA and SEO
     * files. The auth cookie has to be refreshed on real page and API
     * requests, not on every favicon fetch, and the service worker, manifest,
     * offline page, robots and sitemap must never be redirected to sign-in.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.webmanifest|offline\\.html|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
