// Supabase environment reading, in one place.
//
// Both values are safe to expose to the browser. The URL identifies the
// project and the publishable (anon) key only grants what Row Level Security
// allows. The SECRET key (formerly service_role) bypasses RLS entirely and
// must never appear in a NEXT_PUBLIC_ variable or anywhere in this directory.

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing ${name}. Add it to .env.local for local development and to ` +
        `the Vercel project's Environment Variables for deployments. ` +
        `See .env.example.`,
    );
  }
  return value;
}

export function supabaseUrl(): string {
  return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey(): string {
  return required(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
