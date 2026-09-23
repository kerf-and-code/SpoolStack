import Link from 'next/link';
import { NavLinks } from '@/components/nav-links';
import { requireUser } from '@/lib/auth';

// The proxy already blocks unauthenticated requests to /app. requireUser() is
// the second lock: proxy config is one regex edit away from a hole, and a
// layout that assumes a user without proving one is how data leaks.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <Link href="/app" className="font-semibold tracking-tight">
            SpoolStack
          </Link>
          <div className="order-last w-full sm:order-none sm:w-auto">
            <NavLinks />
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden opacity-60 md:inline">{email}</span>
            <form action="/auth/sign-out" method="post">
              <button
                type="submit"
                className="rounded-md border border-black/15 px-2.5 py-1 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
