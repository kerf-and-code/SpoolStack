import type { ServerClient } from '@/lib/supabase/server';

/**
 * The user's currency, for display. Falls back to USD when no settings row
 * exists yet, which is the column default in db/schema.sql, so the fallback
 * and the database agree.
 */
export async function getCurrency(supabase: ServerClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from('user_settings')
    .select('currency')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.currency ?? 'USD';
}

/** Active domains for a domain picker. Phase 1 seeds only 'fdm'. */
export async function getDomainOptions(
  supabase: ServerClient,
): Promise<{ value: string; label: string }[]> {
  const { data } = await supabase
    .from('domains')
    .select('id, display_name')
    .eq('is_active', true)
    .order('sort_order');
  return (data ?? []).map((d) => ({ value: d.id, label: d.display_name }));
}
