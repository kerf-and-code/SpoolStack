import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Served at /sitemap.xml. Only the public pages. Add new public pages here.
const PAGES: { path: string; changeFrequency: 'weekly' | 'monthly' | 'yearly'; priority: number }[] = [
  { path: '/', changeFrequency: 'monthly', priority: 1 },
  { path: '/features', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/tools', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/tools/print-cost-calculator', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/about', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((p) => ({
    url: p.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${p.path}`,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
