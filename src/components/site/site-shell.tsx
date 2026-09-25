// Chrome for every public page: header, graph-paper background, footer.
// The signed-in app under /app does not use this; it has its own layout.

import Link from 'next/link';
import { LogoMark } from './logo-mark';
import { SiteNav } from './site-nav';

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '/features', label: 'Features' },
      { href: '/tools', label: 'Free tools' },
      { href: '/tools/print-cost-calculator', label: 'Print cost calculator' },
      { href: '/sign-in', label: 'Sign in' },
    ],
  },
  {
    title: 'Kerf and Code',
    links: [
      { href: '/about', label: 'About' },
      { href: '/faq', label: 'FAQ' },
      { href: '/contact', label: 'Contact' },
      { href: '/privacy', label: 'Privacy' },
    ],
  },
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-grid site-focus flex min-h-full flex-1 flex-col text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-panel focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="SpoolStack home" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <LogoMark size={32} className="rounded-[22%] dark:ring-1 dark:ring-line" />
            <span className="tracking-[-0.03em]">spoolstack</span>
          </Link>
          <SiteNav />
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-line bg-paper">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
              <LogoMark size={28} className="rounded-[22%] dark:ring-1 dark:ring-line" />
              <span className="tracking-[-0.03em]">spoolstack</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted">
              A run log for people who make things. Free to use, made by Kerf and Code LLC.
            </p>
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">{col.title}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:text-accent-text">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-line">
          <p className="mx-auto max-w-6xl px-4 py-5 font-mono text-xs text-muted sm:px-6">
            &copy; {new Date().getFullYear()} Kerf and Code LLC
          </p>
        </div>
      </footer>
    </div>
  );
}
