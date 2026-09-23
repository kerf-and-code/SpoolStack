// The public address of the site, for canonical links, the sitemap, robots
// and absolute Open Graph image URLs. Server-side only.
//
// Resolution order:
//   1. NEXT_PUBLIC_SITE_URL, if set. An explicit override for any environment.
//   2. VERCEL_PROJECT_PRODUCTION_URL, a Vercel system variable holding the
//      project's production domain without the scheme. It moves to
//      spool-stack.com by itself once that domain is added as a production
//      domain in Vercel, so the switch needs no code change.
//   3. The vercel.app address the app has used since M0.

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  return 'https://spool-stack-six.vercel.app';
}

export const SITE_URL = resolveSiteUrl();

export const SITE_NAME = 'SpoolStack';

export const SITE_DESCRIPTION =
  'A run log for 3D printing and small-batch making. Log every print, import settings straight from your slicer file, and build a history of what worked and what it cost.';

export const CONTACT_EMAIL = 'kncadmin@kerfandcode.com';

/** Brand colours, matching the icon. */
export const BRAND = {
  ink: '#111111',
  paper: '#F4F1EA',
  accent: '#F26B1D',
} as const;
