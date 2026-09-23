'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import {
  dbErrorMessage,
  errorState,
  fieldErrorsFrom,
  formObject,
  optionalNumber,
  optionalText,
  requiredText,
  type FormState,
} from '@/lib/forms';

const projectSchema = z.object({
  name: requiredText('Name', 100),
  client: optionalText('Client', 100),
  description: optionalText('Description', 2000),
  sale_price: optionalNumber('Sale price', { min: 0, max: 10_000_000 }),
  target_quantity: optionalNumber('Target quantity', { positive: true, integer: true, max: 10_000_000 }),
});

export async function saveProject(
  id: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const parsed = projectSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return errorState('Check the highlighted fields.', fieldErrorsFrom(parsed.error));
  }

  if (id) {
    const { data, error } = await supabase.from('projects').update(parsed.data).eq('id', id).select('id');
    if (error) return errorState(dbErrorMessage(error, 'project'));
    if (!data || data.length === 0) return errorState('That project no longer exists.');
  } else {
    const { error } = await supabase.from('projects').insert({ ...parsed.data, user_id: userId });
    if (error) return errorState(dbErrorMessage(error, 'project'));
  }

  revalidatePath('/app/projects');
  revalidatePath('/app');
  redirect('/app/projects?notice=saved');
}

export async function setProjectArchived(id: string, archived: boolean): Promise<void> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from('projects')
    .update({ status: archived ? 'archived' : 'active' })
    .eq('id', id)
    .select('id');
  if (error || !data || data.length === 0) {
    redirect(`/app/projects/${id}?notice=update_failed`);
  }
  revalidatePath('/app/projects');
  revalidatePath('/app');
  redirect(`/app/projects?notice=${archived ? 'archived' : 'restored'}`);
}

/** runs.project_id is ON DELETE SET NULL: deleting a used project would silently ungroup its runs. */
export async function deleteProject(id: string): Promise<void> {
  const { supabase } = await requireUser();

  const { count, error: countError } = await supabase
    .from('runs')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', id);
  if (countError) redirect(`/app/projects/${id}?notice=delete_failed`);
  if ((count ?? 0) > 0) redirect(`/app/projects/${id}?notice=in_use`);

  const { data, error } = await supabase.from('projects').delete().eq('id', id).select('id');
  if (error || !data || data.length === 0) {
    redirect(`/app/projects/${id}?notice=delete_failed`);
  }

  revalidatePath('/app/projects');
  revalidatePath('/app');
  redirect('/app/projects?notice=deleted');
}
