// The one way server code gets "the current user".
//
// Every Server Action and every page under /app calls this first. The proxy
// already redirects signed-out requests away from /app, but Server Actions
// are POST endpoints that can be called directly, so each one must prove the
// user itself. RLS would still block a forged write, but failing here gives
// a redirect instead of a database error.

import { redirect } from 'next/navigation';
import { createClient, type ServerClient } from '@/lib/supabase/server';

export async function requireUser(): Promise<{
  supabase: ServerClient;
  userId: string;
  email: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  return { supabase, userId: user.id, email: user.email ?? null };
}
