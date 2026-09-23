// OAuth and magic-link landing point.
//
// Supabase redirects here with a one-time `code`, which is exchanged for a
// session. The cookies written by that exchange are what sign the user in.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Only allow same-origin relative paths as a redirect target. Without this,
 * ?next=https://evil.example turns the callback into an open redirect, which
 * is a real phishing vector on an auth endpoint.
 */
function safeNext(raw: string | null): string {
  if (!raw) return '/app';
  if (!raw.startsWith('/')) return '/app';
  if (raw.startsWith('//')) return '/app';
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Behind Vercel's proxy, `origin` is the internal host rather than the one
  // the user typed. x-forwarded-host carries the real one.
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (process.env.NODE_ENV !== 'development' && forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${next}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
