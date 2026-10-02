'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { dbErrorMessage } from '@/lib/forms';
import { MAX_ACTIVE_TOKENS, newUploadToken } from '@/lib/upload-tokens';

const UUID = /^[0-9a-f-]{36}$/i;

export type CreateTokenResult = { ok: true; token: string; name: string } | { ok: false; message: string };

/**
 * A new upload token. The token itself is returned once, here, and never
 * stored: the database keeps only its hash.
 */
export async function createUploadToken(rawName: string): Promise<CreateTokenResult> {
  const { supabase, userId } = await requireUser();
  const name = (typeof rawName === 'string' ? rawName : '').trim().slice(0, 60) || 'My PC';

  const { count } = await supabase
    .from('upload_tokens')
    .select('*', { count: 'exact', head: true })
    .is('revoked_at', null);
  if ((count ?? 0) >= MAX_ACTIVE_TOKENS) {
    return { ok: false, message: `You have ${MAX_ACTIVE_TOKENS} active tokens. Revoke one you no longer use first.` };
  }

  const t = newUploadToken();
  const { error } = await supabase
    .from('upload_tokens')
    .insert({ user_id: userId, name, token_hash: t.hash, token_prefix: t.prefix });
  if (error) return { ok: false, message: dbErrorMessage(error, 'token') };

  revalidatePath('/app/settings/uploader');
  return { ok: true, token: t.token, name };
}

/** Revoked tokens stop working at once and stay listed, so you can see what was cut off. */
export async function revokeUploadToken(tokenId: string): Promise<void> {
  const { supabase } = await requireUser();
  if (typeof tokenId !== 'string' || !UUID.test(tokenId)) return;
  const { error } = await supabase
    .from('upload_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
    .is('revoked_at', null);
  if (error) console.error('token not revoked', tokenId, error.message);
  revalidatePath('/app/settings/uploader');
  revalidatePath('/app');
}
