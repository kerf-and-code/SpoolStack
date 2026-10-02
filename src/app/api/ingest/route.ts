// /api/ingest: where the slicer uploader sends each sliced file.
//
//   POST  Authorization: Bearer ssk_...   body {"file_name": "...", "text": "..."}
//         -> 201 {"id": "<pending run id>"}       saved to the "Did it print?" inbox
//   GET   Authorization: Bearer ssk_...
//         -> 200 {"ok": true, "name": "My PC"}    the uploader's --check
//
// There is no user session here: the upload token is the credential, and the
// two database functions it calls check it before doing anything. This route
// uses the public (anon) key only, never the secret key.
//
// Every refusal comes back as JSON {"error": "..."} with a status the script
// acts on: 401 and 4xx are not retried, 429 and 5xx are queued and retried.

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { Database, Json } from '@/lib/database.types';
import { INGEST_MAX_TEXT_CHARS, bearerToken, buildIngest, ingestErrorResponse } from '@/lib/ingest';
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/env';

// JSON wrapping and escaping add a little over the text limit.
const MAX_BODY_BYTES = INGEST_MAX_TEXT_CHARS + 64 * 1024;

function anonClient() {
  return createClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

const NO_TOKEN = 'Missing or malformed upload token. Run the uploader with --setup and your token.';

export async function GET(request: Request) {
  const token = bearerToken(request.headers.get('authorization'));
  if (!token) return fail(401, NO_TOKEN);

  const { data, error } = await anonClient().rpc('check_upload_token', { p_token: token });
  if (error) {
    const r = ingestErrorResponse(error);
    return fail(r.status, r.message);
  }
  return NextResponse.json({ ok: true, name: data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const token = bearerToken(request.headers.get('authorization'));
  if (!token) return fail(401, NO_TOKEN);

  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) return fail(413, 'The upload is too large. Update the uploader script.');

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return fail(400, 'Could not read the upload.');
  }
  if (raw.length > MAX_BODY_BYTES) return fail(413, 'The upload is too large. Update the uploader script.');

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, 'The upload is not valid JSON.');
  }

  const built = buildIngest(body);
  if (!built.ok) return fail(built.status, built.message);

  const { data, error } = await anonClient().rpc('ingest_slice', {
    p_token: token,
    ...built.args,
    // ParsedRun is plain JSON (strings, numbers, booleans, nulls); the
    // interface just lacks the index signature the Json type asks for.
    p_parsed: built.args.p_parsed as unknown as Json,
  });
  if (error) {
    const r = ingestErrorResponse(error);
    if (r.status >= 500) console.error('ingest_slice failed', error.code, error.message);
    return fail(r.status, r.message);
  }

  return NextResponse.json(
    {
      id: data,
      file_name: built.args.p_file_name,
      message: 'Saved. It will be waiting under "Did it print?" in SpoolStack.',
    },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  );
}
