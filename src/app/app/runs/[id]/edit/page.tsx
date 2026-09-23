import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/auth';
import { formatDurationForInput } from '@/lib/duration';
import { parametersToFields } from '@/lib/run-params';
import { updateRun } from '../../actions';
import { loadRunFormData } from '../../data';
import { RunForm } from '../../run-form';
import type { RunEditInitial } from '../../types';

export const metadata: Metadata = { title: 'Edit run : SpoolStack' };

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v));

export default async function EditRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const [{ data: run, error }, defectsRes] = await Promise.all([
    supabase.from('runs').select('*').eq('id', id).maybeSingle(),
    supabase.from('run_defects').select('defect_type_id, severity').eq('run_id', id),
  ]);
  // A malformed id is a Postgres cast error, another user's id is no row (RLS).
  if (error || !run) notFound();

  const data = await loadRunFormData(supabase, {
    machineId: run.machine_id,
    materialId: run.material_id,
    projectId: run.project_id,
  });

  const defects: Record<number, string> = {};
  for (const d of defectsRes.data ?? []) defects[d.defect_type_id] = str(d.severity);

  const initial: RunEditInitial = {
    runId: run.id,
    completedAtIso: run.completed_at,
    weighed: run.material_qty_used !== null && !run.material_qty_estimated,
    defects,
    values: {
      machine_id: str(run.machine_id),
      material_id: str(run.material_id),
      project_id: str(run.project_id),
      title: str(run.title),
      outcome: run.outcome,
      duration: formatDurationForInput(run.duration_minutes),
      material_qty_used: str(run.material_qty_used),
      units_produced: str(run.units_produced),
      units_good: run.outcome === 'partial' ? str(run.units_good) : '',
      active_labor_minutes: run.active_labor_minutes > 0 ? str(run.active_labor_minutes) : '',
      quality_rating: str(run.quality_rating),
      notes: str(run.notes),
      ...parametersToFields(run.parameters, data.parameterDefs),
    },
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Edit run" back={{ href: `/app/runs/${run.id}`, label: 'Back to run' }} />
      <RunForm data={data} action={updateRun.bind(null, run.id)} initial={initial} />
    </div>
  );
}
