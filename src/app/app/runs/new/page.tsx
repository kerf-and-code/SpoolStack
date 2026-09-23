import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/auth';
import { RunForm } from '../run-form';
import type { RunFormData } from '../types';

export const metadata: Metadata = { title: 'Log a run : SpoolStack' };

export default async function NewRunPage() {
  const { supabase } = await requireUser();

  const [machines, materials, projects, defs, defects, recent] = await Promise.all([
    supabase.from('machines').select('id, name, domain_id, make, model').eq('is_active', true).order('name'),
    supabase
      .from('materials')
      .select('id, name, unit, domain_id, category, brand')
      .eq('is_active', true)
      .order('name'),
    supabase.from('projects').select('id, name').eq('status', 'active').order('name'),
    supabase
      .from('parameter_defs')
      .select('key, display_name, group_name, data_type, unit, min_value, max_value, step, enum_options, is_required, help_text, sort_order, domain_id')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('defect_types')
      .select('id, domain_id, display_name, description, is_process_related')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('runs')
      .select('id, title, created_at, machine_id, material_id, project_id, duration_minutes, material_qty_used, units_produced, active_labor_minutes, parameters')
      .order('created_at', { ascending: false })
      .limit(25),
  ]);

  const failed = [machines, materials, projects, defs, defects, recent].find((r) => r.error);
  if (failed?.error) {
    throw new Error(`Could not load the run form: ${failed.error.message}`);
  }

  const data: RunFormData = {
    machines: machines.data ?? [],
    materials: materials.data ?? [],
    projects: projects.data ?? [],
    parameterDefs: defs.data ?? [],
    defectTypes: defects.data ?? [],
    recentRuns: recent.data ?? [],
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Log a run" back={{ href: '/app/runs', label: 'Runs' }} />
      <RunForm data={data} />
    </div>
  );
}
