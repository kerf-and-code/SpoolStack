import Link from 'next/link';

// Rendered inside the app shell when a page under /app calls notFound(): a
// run, machine, material or project id that does not exist or belongs to
// another account. Row level security makes those two cases look identical,
// which is the point, so the message covers both.
export default function AppNotFound() {
  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
      <p className="mt-2 mb-6 text-sm opacity-70">
        That record does not exist in your log. It may have been deleted, or the link may be wrong.
      </p>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/app/runs" className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background">
          Runs
        </Link>
        <Link
          href="/app"
          className="rounded-md border border-black/15 px-3 py-1.5 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
