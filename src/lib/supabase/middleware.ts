// Session refresh plus route protection, run on every matched request.
//
// Two things happen here and the order matters:
//   1. supabase.auth.getUser() is called BEFORE any response is generated. A
//      token refresh that completes after the response is committed cannot
//      write its cookies, so the session is silently lost and the next request
//      refreshes again.
//   2. Cookies written by that refresh are copied onto a NEW NextResponse. The
//      dance below looks redundant but is not: mutating request.cookies alone
//      does not reach the browser, and building the response before the
//      refresh loses the Set-Cookie headers.
//
// The `headers` argument to setAll is the part most copied-from-the-internet
// versions of this file miss. @supabase/ssr passes cache-control headers that
// must land on any response carrying auth cookies. Without them a CDN, and
// Vercel is a CDN, can cache a response containing one user's session token
// and serve it to somebody else.

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAnonKey, supabaseUrl } from './env';

/** Everything under these prefixes requires a signed-in user. */
const PROTECTED_PREFIXES = ['/app'];

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Do not remove or reorder. See the note at the top of this file.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/sign-in';
    redirectUrl.search = '';
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && pathname === '/sign-in') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/app';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
