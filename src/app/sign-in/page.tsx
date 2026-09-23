import Link from 'next/link';
import type { Metadata } from 'next';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = {
  title: 'Sign in to SpoolStack',
};

function safeNext(raw: string | undefined): string {
  if (!raw) return '/app';
  if (!raw.startsWith('/')) return '/app';
  if (raw.startsWith('//')) return '/app';
  return raw;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-sm opacity-60 hover:opacity-100">
          SpoolStack
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 mb-8 text-sm opacity-70">
          Your run log, your machines, your materials.
        </p>
        <SignInForm next={safeNext(params.next)} initialError={params.error} />
      </div>
    </main>
  );
}
