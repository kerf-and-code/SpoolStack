// Server Supabase client, for Server Components, Server Actions and Route
// Handlers.
//
// A NEW client must be created per request. Never hoist this into a module
// level constant: Next caches modules across requests, and a shared client
// would leak one user's session into another user's response.
//
// Because this client carries the signed-in user's cookies, every query it
// runs is subject to Row Level Security. That is the point: the policies in
// db/schema.sql are the access control, not application-level filtering.
//
// Typed with the generated Database type, so a renamed or dropped column is a
// compile error here rather than a runtime surprise. Regenerate
// src/lib/database.types.ts after every schema change.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';
import { supabaseAnonKey, supabaseUrl } from './env';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. This throw is expected and
          // safe to swallow: src/proxy.ts refreshes the session on every
          // request, so the refreshed cookies still reach the browser. Only
          // remove this catch if the proxy is removed.
        }
      },
    },
  });
}

export type ServerClient = Awaited<ReturnType<typeof createClient>>;
