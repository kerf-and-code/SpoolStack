import Link from 'next/link';

export function PageHeader({
  title,
  description,
  action,
  back,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-8">
      {back ? (
        <Link href={back.href} className="text-sm opacity-60 hover:opacity-100">
          &larr; {back.label}
        </Link>
      ) : null}
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-sm opacity-70">{description}</p> : null}
        </div>
        {action ? (
          <Link
            href={action.href}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            {action.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** A one-line banner driven by a ?notice= query param after a redirect. */
export function Notice({ tone, children }: { tone: 'ok' | 'warn' | 'error'; children: React.ReactNode }) {
  const styles = {
    ok: 'border-emerald-500/40 bg-emerald-500/10',
    warn: 'border-amber-500/40 bg-amber-500/10',
    error: 'border-red-500/40 bg-red-500/10',
  }[tone];
  return <div className={`mb-6 rounded-md border px-3 py-2 text-sm ${styles}`}>{children}</div>;
}
