import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Served at /robots.txt. The signed-in app and the auth routes have nothing a
// crawler can see except a redirect to sign-in, so they are kept out of the
// index entirely.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/app', '/auth'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
