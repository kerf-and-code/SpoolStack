'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const LINKS = [
  { href: '/app', label: 'Dashboard', exact: true },
  { href: '/app/runs', label: 'Runs' },
  { href: '/app/machines', label: 'Machines' },
  { href: '/app/materials', label: 'Materials' },
  { href: '/app/projects', label: 'Projects' },
  { href: '/app/settings', label: 'Settings' },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** The top links, shown from the sm breakpoint up. Phones get BottomTabs instead. */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="-mx-1 flex items-center gap-1 text-sm">
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href, link.exact);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={
              'whitespace-nowrap rounded-md px-2.5 py-1.5 ' +
              (active
                ? 'bg-black/5 font-medium dark:bg-white/10'
                : 'opacity-70 hover:opacity-100')
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Phone navigation: four labeled tabs plus More, fixed to the bottom of the
// screen where the thumb is. Settings is a tab of its own because the
// diagnosis-training switch and the slicer uploader live there, and a phone
// user has to be able to find them. Machines and Projects are set up once and
// rarely revisited, so they sit one level down under More.
// ---------------------------------------------------------------------------

type Tab = { href: string; label: string; exact?: boolean; icon: React.ReactNode };

const iconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const TABS: Tab[] = [
  {
    href: '/app',
    label: 'Dashboard',
    exact: true,
    icon: (
      <svg {...iconProps}>
        <path d="M4 11.5 12 5l8 6.5" />
        <path d="M6 10v9h12v-9" />
      </svg>
    ),
  },
  {
    href: '/app/runs',
    label: 'Runs',
    icon: (
      <svg {...iconProps}>
        <path d="M8 6h12M8 12h12M8 18h12" />
        <path d="M4 6h.01M4 12h.01M4 18h.01" />
      </svg>
    ),
  },
  {
    href: '/app/materials',
    label: 'Materials',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    ),
  },
  {
    href: '/app/settings',
    label: 'Settings',
    icon: (
      <svg {...iconProps}>
        <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="10" cy="17" r="2" />
      </svg>
    ),
  },
];

const MORE_LINKS = [
  { href: '/app/machines', label: 'Machines' },
  { href: '/app/projects', label: 'Projects' },
];

/**
 * The run form has its own fixed Save bar at the bottom of the screen, so the
 * tabs step aside there instead of covering it.
 */
function hasOwnBottomBar(pathname: string) {
  return pathname === '/app/runs/new' || /^\/app\/runs\/[^/]+\/edit$/.test(pathname);
}

export function BottomTabs() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  if (hasOwnBottomBar(pathname)) return null;

  const moreActive = MORE_LINKS.some((l) => isActive(pathname, l.href));
  const tabClass = (active: boolean) =>
    'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs ' +
    (active ? 'font-semibold' : 'opacity-70');
  // The selected tab is marked by a bar along its top edge and bold text, not
  // by colour alone.
  const marker = (active: boolean) =>
    active ? <span aria-hidden="true" className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-foreground" /> : null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-background pb-[env(safe-area-inset-bottom)] sm:hidden dark:border-white/15"
    >
      {moreOpen ? (
        <div id="more-menu" className="border-b border-black/10 px-4 py-2 dark:border-white/15">
          <ul className="flex flex-col">
            {MORE_LINKS.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={'flex min-h-12 items-center text-base ' + (active ? 'font-semibold' : '')}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <div className="flex">
        {TABS.map((tab) => {
          const active = !moreOpen && isActive(pathname, tab.href, tab.exact);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={() => setMoreOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={tabClass(active)}
            >
              {marker(active)}
              {tab.icon}
              <span>{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setMoreOpen(false);
          }}
          aria-expanded={moreOpen}
          aria-controls="more-menu"
          className={tabClass(moreOpen || moreActive)}
        >
          {marker(moreOpen || moreActive)}
          <svg {...iconProps}>
            <circle cx="6" cy="12" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="18" cy="12" r="1" />
          </svg>
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
