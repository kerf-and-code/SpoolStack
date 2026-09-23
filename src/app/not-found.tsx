import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page not found : SpoolStack',
  robots: { index: false },
};

// Any URL that matches no route, and any public page that calls notFound().
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-sm opacity-60 hover:opacity-100">
          SpoolStack
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 mb-8 text-sm opacity-70">
          There is nothing at this address. It may have moved, or the link may have a typo in it.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/" className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background">
            Home
          </Link>
          <Link
            href="/app"
            className="rounded-md border border-black/15 px-3 py-1.5 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Your log
          </Link>
        </div>
      </div>
    </main>
  );
}
