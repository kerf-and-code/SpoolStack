// Browser Supabase client. Use this only inside "use client" components.
// Server Components, Server Actions and Route Handlers use ./server instead.

import { createBrowserClient } from '@supabase/ssr';
import { supabaseAnonKey, supabaseUrl } from './env';

export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
