'use client';

// Header navigation for the public site. Client-side only for one reason:
// marking the current page. The mobile menu is a native <details>, so it
// opens and closes without any script of its own.

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const NAV_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/tools', label: 'Free tools' },
  { href: '/faq', label: 'FAQ' },
  { href: '/about', label: 'About' },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** A <details> menu stays open across client-side navigation; close it. */
function closeMenu(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.closest('details')?.removeAttribute('open');
}

export function SiteNav() {
  const pathname = usePathname() ?? '/';

  return (
    <>
      <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
        {NAV_LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={
                'rounded-md px-3 py-1.5 text-sm transition-colors ' +
                (active ? 'bg-ink/[0.07] font-medium text-ink' : 'text-muted hover:text-ink')
              }
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <Link href="/sign-in" className="hidden px-2 text-sm text-muted hover:text-ink sm:inline">
          Sign in
        </Link>
        <Link href="/sign-in" className="btn btn-primary btn-sm">
          Start logging
        </Link>

        <details className="group relative md:hidden">
          <summary
            className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-line [&::-webkit-details-marker]:hidden"
            aria-label="Menu"
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" className="group-open:hidden">
              <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" className="hidden group-open:block">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </summary>
          <div className="site-panel absolute right-0 top-full z-40 mt-3 w-56 p-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(pathname, link.href) ? 'page' : undefined}
                onClick={closeMenu}
                className="block rounded-md px-3 py-2 text-sm hover:bg-ink/[0.06] aria-[current=page]:font-medium"
              >
                {link.label}
              </Link>
            ))}
            <div className="my-1 border-t border-line" />
            <Link href="/sign-in" onClick={closeMenu} className="block rounded-md px-3 py-2 text-sm hover:bg-ink/[0.06]">
              Sign in
            </Link>
          </div>
        </details>
      </div>
    </>
  );
}
