// Small building blocks for the public site. Server components.

import Link from 'next/link';

/**
 * Section label, written as a gcode comment: "; features". Slicers write
 * every setting that way, so it doubles as a nod to the file format the app
 * reads.
 */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-accent-text">
      <span aria-hidden="true">; </span>
      {children}
    </p>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ink';

export function ButtonLink({
  href,
  variant = 'primary',
  size,
  children,
  className = '',
}: {
  href: string;
  variant?: ButtonVariant;
  size?: 'sm';
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className}`}>
      {children}
    </Link>
  );
}

/** A divider drawn as layer lines stepping in, like the side of a print. */
export function LayerRule({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`flex flex-col items-center gap-[3px] py-2 ${className}`}>
      <span className="h-[3px] w-24 rounded-full bg-accent" />
      <span className="h-[3px] w-32 rounded-full bg-ink/25" />
      <span className="h-[3px] w-40 rounded-full bg-ink/15" />
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="pt-14 pb-10 sm:pt-20">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{title}</h1>
      {children ? <div className="mt-5 max-w-2xl text-lg text-muted">{children}</div> : null}
    </header>
  );
}
