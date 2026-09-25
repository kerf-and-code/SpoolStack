import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfirmSubmit } from '@/components/confirm-submit';
import { LocalTime } from '@/components/local-time';
import { Notice } from '@/components/page-header';
import { requireUser } from '@/lib/auth';
import type { Json } from '@/lib/database.types';
import { formatDuration } from '@/lib/duration';
import { formatNumber } from '@/lib/format';
import { PHOTO_BUCKET, PHOTOS_PER_RUN_LIMIT, defaultPhotoKind, isPhotoKind } from '@/lib/photos';
import { deleteRun } from '../actions';
import { PARAM_DEF_COLUMNS } from '../data';
import { OutcomeBadge } from '../outcome-badge';
import { PhotoCard, type DefectOption } from './photo-card';
import { PhotoUploader } from './photo-uploader';

export const metadata: Metadata = { title: 'Run : SpoolStack' };

const NOTICES: Record<string, { tone: 'ok' | 'error'; text: string }> = {
  saved: { tone: 'ok', text: 'Changes saved.' },
  created: { tone: 'ok', text: 'Run saved. When the print is off the bed, add photos of it below.' },
  delete_failed: { tone: 'error', text: 'Delete failed. Nothing was removed.' },
};

const MATERIAL_SOURCE_TEXT: Record<string, string> = {
  stated_grams: "the slicer's weight estimate",
  from_volume: 'estimated from filament volume',
  from_length: 'estimated from filament length',
};

function asObject(v: Json | null | undefined): Record<string, Json | undefined> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, Json | undefined>) : {};
}

function displayValue(v: Json | undefined, unit: string | null): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return `${formatNumber(v, 3)}${unit ? ` ${unit}` : ''}`;
  if (typeof v === 'string') return v.replace(/_/g, ' ');
  return JSON.stringify(v);
}

export default async function RunDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const { notice } = await searchParams;
  const { supabase, userId } = await requireUser();

  const [{ data: run, error }, defectsRes, photosRes] = await Promise.all([
    supabase
      .from('runs')
      .select('*, machines(name), materials(name, unit), projects(name)')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('run_defects')
      .select('defect_type_id, severity, defect_types(display_name, is_process_related, sort_order)')
      .eq('run_id', id),
    supabase
      .from('run_photos')
      .select('id, storage_path, kind, defect_type_id')
      .eq('run_id', id)
      .order('created_at'),
  ]);
  if (error || !run) notFound();

  const [{ data: defs }, { data: defectTypes }] = await Promise.all([
    supabase.from('parameter_defs').select(PARAM_DEF_COLUMNS).eq('domain_id', run.domain_id).order('sort_order'),
    supabase
      .from('defect_types')
      .select('id, display_name, sort_order')
      .eq('domain_id', run.domain_id)
      .eq('is_active', true)
      .order('sort_order'),
  ]);

  // Photos are private: each gets a signed URL that expires in an hour, which
  // is regenerated on every visit to this page.
  const photos = photosRes.data ?? [];
  const signed = new Map<string, string>();
  if (photos.length > 0) {
    const { data: urls } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(photos.map((p) => p.storage_path), 3600);
    for (const u of urls ?? []) {
      if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    }
  }

  const unit = run.materials?.unit ?? 'g';
  const noticeInfo = notice ? NOTICES[notice] : undefined;

  // Settings, grouped as the form groups them. Keys no longer in the
  // dictionary (retired later) are still shown, under their raw key.
  const bag = asObject(run.parameters);
  const groups = new Map<string, { label: string; value: string }[]>();
  const known = new Set<string>();
  for (const d of defs ?? []) {
    known.add(d.key);
    if (!(d.key in bag)) continue;
    const list = groups.get(d.group_name) ?? [];
    list.push({ label: d.display_name, value: displayValue(bag[d.key], d.unit) });
    groups.set(d.group_name, list);
  }
  const unknown = Object.keys(bag).filter((k) => !known.has(k));
  if (unknown.length > 0) {
    groups.set(
      'Other',
      unknown.map((k) => ({ label: k, value: displayValue(bag[k], null) })),
    );
  }

  const defects = (defectsRes.data ?? [])
    .filter((d) => d.defect_types)
    .sort((a, b) => (a.defect_types?.sort_order ?? 0) - (b.defect_types?.sort_order ?? 0));

  const runDefectIds = new Set(defects.map((d) => d.defect_type_id));
  const defectOptions: DefectOption[] = (defectTypes ?? []).map((d) => ({
    id: d.id,
    label: d.display_name,
    onRun: runDefectIds.has(d.id),
  }));

  const meta = asObject(run.source_metadata);
  const metaText = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string) : null);

  const facts: { label: string; value: React.ReactNode }[] = [
    { label: 'Machine', value: run.machines?.name ?? <span className="opacity-50">none</span> },
    { label: 'Material', value: run.materials?.name ?? <span className="opacity-50">none</span> },
    { label: 'Project', value: run.projects?.name ?? <span className="opacity-50">none</span> },
    {
      label: 'Duration',
      value:
        run.duration_minutes !== null ? (
          <>
            {formatDuration(run.duration_minutes)}
            {run.duration_minutes > 24 * 60 ? (
              <span className="ml-2 text-xs font-medium text-amber-700 dark:text-amber-400">over a day, check it</span>
            ) : null}
          </>
        ) : (
          <span className="opacity-50">not recorded</span>
        ),
    },
    {
      label: 'Material used',
      value:
        run.material_qty_used !== null ? (
          <>
            {formatNumber(run.material_qty_used, 2)} {unit}
            <span className="ml-2 text-xs opacity-60">{run.material_qty_estimated ? 'estimate' : 'weighed'}</span>
          </>
        ) : (
          <span className="opacity-50">not recorded</span>
        ),
    },
    {
      label: 'Parts',
      value: `${run.units_good ?? run.units_produced} usable of ${run.units_produced}`,
    },
    {
      label: 'Hands-on time',
      value: run.active_labor_minutes > 0 ? formatDuration(run.active_labor_minutes) : <span className="opacity-50">none</span>,
    },
    {
      label: 'Quality',
      value: run.quality_rating !== null ? `${run.quality_rating} of 5` : <span className="opacity-50">not rated</span>,
    },
  ];

  return (
    <div className="max-w-3xl">
      <Link href="/app/runs" className="text-sm opacity-60 hover:opacity-100">
        &larr; Runs
      </Link>
      <div className="mt-1 mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {run.title || run.materials?.name || 'Untitled run'}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm opacity-70">
            <OutcomeBadge outcome={run.outcome} />
            <span>
              Finished <LocalTime iso={run.completed_at ?? run.created_at} />
            </span>
            <span>{run.source === 'gcode_import' ? 'Imported from a slicer file' : 'Logged by hand'}</span>
          </p>
        </div>
        <Link
          href={`/app/runs/${run.id}/edit`}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Edit
        </Link>
      </div>

      {noticeInfo ? <Notice tone={noticeInfo.tone}>{noticeInfo.text}</Notice> : null}

      <dl className="grid gap-x-8 gap-y-4 rounded-lg border border-black/10 p-5 sm:grid-cols-2 dark:border-white/15">
        {facts.map((f) => (
          <div key={f.label}>
            <dt className="text-xs uppercase tracking-wide opacity-55">{f.label}</dt>
            <dd className="mt-0.5">{f.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-8" id="photos">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Photos</h2>
          <span className="text-xs opacity-55">
            {photos.length} of {PHOTOS_PER_RUN_LIMIT}
          </span>
        </div>
        <p className="mt-1 text-sm opacity-65">
          A shot of the whole print, and a close-up of anything that went wrong. Tagging the defect each photo shows
          is what will teach SpoolStack to spot it later.
        </p>
        <div className="mt-3">
          <PhotoUploader
            runId={run.id}
            userId={userId}
            defaultKind={defaultPhotoKind(run.outcome)}
            remaining={PHOTOS_PER_RUN_LIMIT - photos.length}
          />
        </div>
        {photos.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p, i) => (
              <PhotoCard
                key={p.id}
                id={p.id}
                index={i}
                url={signed.get(p.storage_path) ?? null}
                kind={isPhotoKind(p.kind) ? p.kind : 'other'}
                defectTypeId={p.defect_type_id}
                defects={defectOptions}
              />
            ))}
          </div>
        ) : null}
      </section>

      {defects.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-semibold">Defects</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {defects.map((d) => (
              <li key={d.defect_type_id} className="flex flex-wrap items-center gap-2">
                <span>{d.defect_types?.display_name}</span>
                {d.severity !== null ? <span className="opacity-60">severity {d.severity} of 5</span> : null}
                {d.defect_types && !d.defect_types.is_process_related ? (
                  <span className="rounded-full border border-black/15 px-2 py-0.5 text-xs opacity-70 dark:border-white/20">
                    not a settings problem
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="font-semibold">Settings used</h2>
        {groups.size === 0 ? (
          <p className="mt-2 text-sm opacity-60">None recorded.</p>
        ) : (
          <div className="mt-3 grid gap-6 sm:grid-cols-2">
            {[...groups.entries()].map(([group, items]) => (
              <div key={group}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-55">{group}</h3>
                <dl className="space-y-1 text-sm">
                  {items.map((i) => (
                    <div key={i.label} className="flex justify-between gap-4">
                      <dt className="opacity-70">{i.label}</dt>
                      <dd className="tabular-nums">{i.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        )}
      </section>

      {run.notes ? (
        <section className="mt-8">
          <h2 className="font-semibold">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">{run.notes}</p>
        </section>
      ) : null}

      {run.source === 'gcode_import' ? (
        <section className="mt-8 rounded-lg border border-black/10 p-4 text-sm dark:border-white/15">
          <h2 className="font-semibold">Imported from</h2>
          <dl className="mt-2 space-y-1">
            {[
              ['File', metaText('file_name')],
              ['Plate', metaText('plate')],
              ['Slicer', metaText('slicer')],
              ['Printer', metaText('printer_model')],
              ['Filament', [metaText('filament_type'), metaText('filament_brand')].filter(Boolean).join(', ') || null],
              ['Weight from', metaText('material_source') ? MATERIAL_SOURCE_TEXT[metaText('material_source')!] ?? metaText('material_source') : null],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="w-24 shrink-0 opacity-60">{k}</dt>
                  <dd className="min-w-0 break-words">{v}</dd>
                </div>
              ))}
          </dl>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs opacity-60">Raw values read from the file</summary>
            <pre className="mt-2 overflow-x-auto rounded bg-black/5 p-3 text-xs dark:bg-white/10">
              {JSON.stringify(meta.raw ?? {}, null, 2)}
            </pre>
          </details>
        </section>
      ) : null}

      <section className="mt-12 border-t border-black/10 pt-6 dark:border-white/15">
        <h2 className="text-base font-semibold">Delete</h2>
        <p className="mt-1 text-sm opacity-65">
          Removes this run, its defects and its photos. Costs and failure rates are recalculated without it. This cannot
          be undone.
        </p>
        <form action={deleteRun.bind(null, run.id)} className="mt-3">
          <ConfirmSubmit
            message="Delete this run? This cannot be undone."
            className="rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-700 hover:bg-red-500/10 dark:text-red-400"
          >
            Delete run
          </ConfirmSubmit>
        </form>
      </section>
    </div>
  );
}
