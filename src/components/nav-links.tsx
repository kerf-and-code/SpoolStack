'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/app', label: 'Dashboard', exact: true },
  { href: '/app/machines', label: 'Machines' },
  { href: '/app/materials', label: 'Materials' },
  { href: '/app/projects', label: 'Projects' },
  { href: '/app/settings', label: 'Settings' },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="-mx-1 flex items-center gap-1 overflow-x-auto text-sm">
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
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
