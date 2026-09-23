'use client';

// The run form: the screen the whole product depends on. If logging a run is
// slow, the log never fills, and every later feature reads the log.
//
// Layout, top to bottom, in the order you know things at the printer:
//   0. Import from a slicer file: fills duration, material and settings.
//   1. Copy from last run: most prints repeat the previous one.
//   2. Quick log: machine, material, outcome, duration, material used, parts,
//      plus any parameter the dictionary marks is_required (for FDM: nozzle
//      temperature and layer height). Promoted automatically from
//      parameter_defs, so a CNC domain's required spindle speed would appear
//      here too with no code change.
//   3. Defects: open by default when the run was not a success.
//   4. Settings used: every other parameter_def, grouped, collapsed.
//   5. Details: finish time, hands-on time, quality, notes. Collapsed.
//
// Inputs are CONTROLLED here (unlike the setup forms) because "copy from last
// run" has to write into them. Submission still goes through onSubmit +
// startTransition, so a validation failure never wipes what was typed.

import Link from 'next/link';
import { startTransition, useActionState, useMemo, useState, useSyncExternalStore } from 'react';
import { formatDuration } from '@/lib/duration';
import { readSlicedFile, titleFromFileName } from '@/lib/gcode-file';
import { parseGcode, validateParameters, type ParameterDef } from '@/lib/gcodeParse';
import { idleState } from '@/lib/forms';
import { matchMachines, matchMaterial } from '@/lib/import-match';
import { PARAM_PREFIX, parametersToFields, type ParamDefRow } from '@/lib/run-params';
import { createMachineFromImport } from '../machines/actions';
import { saveRun } from './actions';
import { ImportPanel, type ImportSummary, type MachineStatus, type MaterialStatus } from './import-panel';
import { OUTCOMES, type MachineOption, type Outcome, type RecentRun, type RunFormData } from './types';

const OUTCOME_STYLE: Record<Outcome, { label: string; on: string }> = {
  success: { label: 'Success', on: 'border-emerald-600 bg-emerald-600 text-white' },
  partial: { label: 'Partial', on: 'border-amber-500 bg-amber-500 text-white' },
  failure: { label: 'Failed', on: 'border-red-600 bg-red-600 text-white' },
  aborted: { label: 'Aborted', on: 'border-neutral-500 bg-neutral-500 text-white' },
};

const inputClass =
  'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-base sm:text-sm outline-none ' +
  'focus:border-black/40 dark:border-white/20 dark:focus:border-white/50 aria-[invalid=true]:border-red-500';

function pickDefault(ids: string[], preferred: string | null | undefined): string {
  if (preferred && ids.includes(preferred)) return preferred;
  if (ids.length === 1) return ids[0];
  return '';
}

/** Most recent run on the same machine and material, else same machine, else any. */
function bestMatch(runs: RecentRun[], machineId: string, materialId: string): RecentRun | null {
  if (runs.length === 0) return null;
  return (
    (machineId && materialId
      ? runs.find((r) => r.machine_id === machineId && r.material_id === materialId)
      : undefined) ??
    (machineId ? runs.find((r) => r.machine_id === machineId) : undefined) ??
    runs[0]
  );
}

export function RunForm({ data }: { data: RunFormData }) {
  const { machines, materials, projects, parameterDefs, defectTypes, recentRuns } = data;
  const [state, dispatch, pending] = useActionState(saveRun, idleState);
  const errors = state.status === 'error' ? state.fieldErrors : {};

  const last = recentRuns[0] ?? null;
  const [values, setValues] = useState<Record<string, string>>(() => ({
    machine_id: pickDefault(machines.map((m) => m.id), last?.machine_id),
    material_id: pickDefault(materials.map((m) => m.id), last?.material_id),
    project_id: '',
    title: '',
    outcome: '',
    duration: '',
    material_qty_used: '',
    units_produced: '1',
    units_good: '',
    completed_at: '',
    active_labor_minutes: '',
    quality_rating: '',
    notes: '',
  }));
  const [weighed, setWeighed] = useState(false);
  const [defects, setDefects] = useState<Record<number, string>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showDefectsOnSuccess, setShowDefectsOnSuccess] = useState(false);
  const [copiedFrom, setCopiedFrom] = useState<RecentRun | null>(null);

  // A machine can be added mid-form from a gcode import, so the list is state.
  const [machineList, setMachineList] = useState<MachineOption[]>(machines);
  const [imported, setImported] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [addingMachine, setAddingMachine] = useState(false);

  // Dates are formatted only on the client: the server renders in UTC, and a
  // server/client mismatch would be a hydration error. useSyncExternalStore
  // returns false during SSR and hydration, true afterwards, with no effect.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const set = (name: string, value: string) => setValues((prev) => ({ ...prev, [name]: value }));

  const machine = machineList.find((m) => m.id === values.machine_id) ?? null;
  const material = materials.find((m) => m.id === values.material_id) ?? null;
  const domainId = machine?.domain_id ?? material?.domain_id ?? 'fdm';

  const defs = useMemo(
    () => parameterDefs.filter((d) => d.domain_id === domainId).sort((a, b) => a.sort_order - b.sort_order),
    [parameterDefs, domainId],
  );
  const requiredDefs = defs.filter((d) => d.is_required);
  const optionalGroups = useMemo(() => {
    const groups = new Map<string, ParamDefRow[]>();
    for (const d of defs.filter((x) => !x.is_required)) {
      const list = groups.get(d.group_name) ?? [];
      list.push(d);
      groups.set(d.group_name, list);
    }
    return [...groups.entries()];
  }, [defs]);
  const domainDefects = defectTypes.filter((d) => d.domain_id === domainId);

  const outcome = values.outcome as Outcome | '';
  const defectsOpen = (outcome !== '' && outcome !== 'success') || showDefectsOnSuccess;

  // Open a collapsed section automatically when it holds an error, so an
  // error is never hidden inside something the user has to think to expand.
  const optionalKeys = new Set(defs.filter((d) => !d.is_required).map((d) => PARAM_PREFIX + d.key));
  const settingsOpen = showSettings || Object.keys(errors).some((k) => optionalKeys.has(k));
  const detailsOpen =
    showDetails || ['completed_at', 'active_labor_minutes', 'quality_rating', 'notes'].some((k) => k in errors);

  const filledSettings = defs.filter((d) => !d.is_required && (values[PARAM_PREFIX + d.key] ?? '') !== '').length;

  const candidate = bestMatch(recentRuns, values.machine_id, values.material_id);

  /** Every parameter field set to blank, so a copy or import never mixes with values already there. */
  function blankParams(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of parameterDefs) out[PARAM_PREFIX + d.key] = '';
    return out;
  }

  function copyFrom(run: RecentRun) {
    setValues((prev) => ({
      ...prev,
      // Keep a machine or material already chosen; fill them only if empty.
      machine_id: prev.machine_id || (run.machine_id && machineList.some((m) => m.id === run.machine_id) ? run.machine_id : ''),
      material_id: prev.material_id || (run.material_id && materials.some((m) => m.id === run.material_id) ? run.material_id : ''),
      project_id: run.project_id && projects.some((p) => p.id === run.project_id) ? run.project_id : '',
      title: run.title ?? '',
      duration: run.duration_minutes !== null ? formatDuration(run.duration_minutes) : '',
      material_qty_used: run.material_qty_used !== null ? String(run.material_qty_used) : '',
      units_produced: String(run.units_produced),
      active_labor_minutes: run.active_labor_minutes > 0 ? String(run.active_labor_minutes) : '',
      // Cleared first: a setting typed before copying must not survive into a
      // record that now claims to be last run's settings.
      ...blankParams(),
      ...parametersToFields(run.parameters, parameterDefs),
      // Deliberately NOT copied: outcome, defects, quality, notes, finish time.
      // Those describe this run, and copying them would quietly repeat last
      // time's result into this one.
    }));
    setWeighed(false);
    setCopiedFrom(run);
    // The record is now last run's, not the file's.
    setImported(null);
    setImportError(null);
  }

  async function importFile(file: File) {
    setImporting(true);
    setImportError(null);
    try {
      const read = await readSlicedFile(file);
      if (!read.ok) {
        setImportError(read.message);
        return;
      }
      const parsed = parseGcode(read.text);

      // Gcode is FDM. Validate against the FDM dictionary, and drop anything
      // clamped: an out-of-range value from a file is shown, not stored.
      const fdmDefs = parameterDefs.filter((d) => d.domain_id === 'fdm');
      const validation = validateParameters(parsed.parameters, fdmDefs as unknown as ParameterDef[]);
      const accepted = { ...validation.accepted };
      const outOfRange: ImportSummary['outOfRange'] = [];
      for (const [key, [original]] of Object.entries(validation.clamped)) {
        delete accepted[key];
        const def = fdmDefs.find((d) => d.key === key);
        outOfRange.push({
          label: def?.display_name ?? key,
          value: original,
          range: def ? `${def.min_value} to ${def.max_value}${def.unit ? ` ${def.unit}` : ''}` : 'a different range',
        });
      }

      // Machine: auto-select only on exactly one match.
      let machineId = values.machine_id;
      let machineStatus: MachineStatus = { kind: 'none' };
      if (parsed.printerModel) {
        const matches = matchMachines(parsed.printerModel, machineList);
        const current = matches.find((m) => m.id === machineId);
        if (current) machineStatus = { kind: 'kept', name: current.name };
        else if (matches.length === 1) {
          machineId = matches[0].id;
          machineStatus = { kind: 'selected', name: matches[0].name };
        } else if (matches.length > 1) {
          machineStatus = { kind: 'ambiguous', model: parsed.printerModel, names: matches.map((m) => m.name) };
        } else {
          machineStatus = {
            kind: 'offer',
            model: parsed.printerModel,
            current: machineList.find((m) => m.id === machineId)?.name ?? null,
          };
        }
      }

      // Material: same rule, with brand as the tie-breaker.
      let materialId = values.material_id;
      let materialStatus: MaterialStatus = { kind: 'none' };
      if (parsed.filamentType) {
        const m = matchMaterial(parsed.filamentType, parsed.filamentBrand, materials, materialId);
        if (m.kind === 'keep') materialStatus = { kind: 'kept', name: m.material.name };
        else if (m.kind === 'select') {
          materialId = m.material.id;
          materialStatus = { kind: 'selected', name: m.material.name };
        } else if (m.kind === 'ambiguous') {
          materialStatus = { kind: 'ambiguous', type: parsed.filamentType, names: m.candidates.map((c) => c.name) };
        } else materialStatus = { kind: 'unmatched', type: parsed.filamentType };
      }

      const paramFields = parametersToFields(accepted, fdmDefs);
      const notes = [...read.notes, ...parsed.warnings];

      setValues((prev) => ({
        ...prev,
        machine_id: machineId,
        material_id: materialId,
        // The file defines this record: a value it does not contain is blank,
        // not left over from whatever was typed or copied before.
        duration: parsed.durationMinutes !== null ? formatDuration(parsed.durationMinutes) : '',
        material_qty_used: parsed.materialQtyUsedG !== null ? String(parsed.materialQtyUsedG) : '',
        title: prev.title || titleFromFileName(read.fileName),
        ...blankParams(),
        ...paramFields,
      }));
      setWeighed(false);
      setCopiedFrom(null);
      setImported({
        fileName: read.fileName,
        plate: read.plate,
        slicer: parsed.slicer,
        durationMinutes: parsed.durationMinutes,
        grams: parsed.materialQtyUsedG,
        materialSource: parsed.materialSource,
        unit: materials.find((m) => m.id === materialId)?.unit ?? 'g',
        settingsFilled: Object.keys(paramFields).length,
        outOfRange,
        notes,
        machine: machineStatus,
        material: materialStatus,
        metadataJson: JSON.stringify({
          parser_version: 2,
          file_name: read.fileName,
          file_kind: read.kind,
          plate: read.plate,
          slicer: parsed.slicer,
          printer_model: parsed.printerModel,
          filament_type: parsed.filamentType,
          filament_brand: parsed.filamentBrand,
          material_source: parsed.materialSource,
          raw: parsed.raw,
          notes,
          clamped: validation.clamped,
          rejected: validation.rejected,
        }),
      });
      // Settings live in a collapsed section. Open it so the user sees what
      // the file filled in before saving.
      if (Object.keys(paramFields).length > 0) setShowSettings(true);
    } catch (e) {
      setImportError(`Could not read that file. ${e instanceof Error ? e.message : ''}`.trim());
    } finally {
      setImporting(false);
    }
  }

  async function addMachineFromFile(model: string) {
    setAddingMachine(true);
    try {
      const result = await createMachineFromImport(model);
      if (!result.ok) {
        setImported((s) => (s ? { ...s, machine: { kind: 'error', model, message: result.message } } : s));
        return;
      }
      const added = result.machine;
      setMachineList((list) =>
        list.some((m) => m.id === added.id) ? list : [...list, added].sort((a, b) => a.name.localeCompare(b.name)),
      );
      set('machine_id', added.id);
      setImported((s) => (s ? { ...s, machine: { kind: 'created', name: added.name } } : s));
    } catch {
      setImported((s) =>
        s ? { ...s, machine: { kind: 'error', model, message: 'Could not add the machine. Try again.' } } : s,
      );
    } finally {
      setAddingMachine(false);
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    // datetime-local has no timezone. The browser knows the user's zone and
    // the server does not, so convert here.
    if (values.completed_at) {
      const d = new Date(values.completed_at);
      if (!Number.isNaN(d.getTime())) formData.set('completed_at_iso', d.toISOString());
    }
    startTransition(() => dispatch(formData));
  }

  const runLabel = (r: RecentRun) => {
    const mat = materials.find((m) => m.id === r.material_id)?.name;
    const what = r.title || mat || 'untitled run';
    return mounted ? `${what}, ${new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : what;
  };

  return (
    <form onSubmit={onSubmit} noValidate className="pb-28">
      <input type="hidden" name="domain_id" value={domainId} />
      <input type="hidden" name="source" value={imported ? 'gcode_import' : 'manual'} />
      {imported ? <input type="hidden" name="source_metadata" value={imported.metadataJson} /> : null}

      {/* ------------------------------------------------- import from file */}
      <ImportPanel
        importing={importing}
        error={importError}
        summary={imported}
        addingMachine={addingMachine}
        onFile={importFile}
        onAddMachine={addMachineFromFile}
      />

      {/* ------------------------------------------------ copy from last run */}
      {candidate ? (
        <div className="mb-8 flex flex-wrap items-center gap-3 rounded-lg border border-black/10 bg-black/[0.03] p-3 dark:border-white/15 dark:bg-white/5">
          <button
            type="button"
            onClick={() => copyFrom(candidate)}
            className="rounded-lg border border-black/20 bg-background px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
          >
            Copy from last run
          </button>
          <span className="min-w-0 flex-1 text-sm opacity-70">
            {copiedFrom ? (
              <>Copied from {runLabel(copiedFrom)}. Change anything that differs, then pick how it went.</>
            ) : (
              <>{runLabel(candidate)}: settings, duration, material used and parts. Not the outcome.</>
            )}
          </span>
        </div>
      ) : null}

      {/* ------------------------------------------------------ quick log */}
      <section className="space-y-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Machine" name="machine_id" error={errors.machine_id}>
            <select
              id="machine_id"
              name="machine_id"
              value={values.machine_id}
              onChange={(e) => set('machine_id', e.target.value)}
              className={inputClass}
              aria-invalid={errors.machine_id ? true : undefined}
            >
              <option value="">{machineList.length === 0 ? 'No machines yet' : 'Choose a machine'}</option>
              {machineList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {machineList.length === 0 ? (
              <Link href="/app/machines/new" className="mt-1 inline-block text-xs underline underline-offset-2">
                Add a machine for energy and wear cost
              </Link>
            ) : null}
          </Field>

          <Field label="Material" name="material_id" error={errors.material_id}>
            <select
              id="material_id"
              name="material_id"
              value={values.material_id}
              onChange={(e) => set('material_id', e.target.value)}
              className={inputClass}
              aria-invalid={errors.material_id ? true : undefined}
            >
              <option value="">{materials.length === 0 ? 'No materials yet' : 'Choose a material'}</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {materials.length === 0 ? (
              <Link href="/app/materials/new" className="mt-1 inline-block text-xs underline underline-offset-2">
                Add a material for material cost
              </Link>
            ) : null}
          </Field>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">
            How did it go? <span className="opacity-50">*</span>
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {OUTCOMES.map((o) => {
              const checked = outcome === o;
              return (
                <label
                  key={o}
                  className={
                    'flex cursor-pointer items-center justify-center rounded-lg border px-3 py-3 text-sm font-medium select-none ' +
                    (checked
                      ? OUTCOME_STYLE[o].on
                      : 'border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10')
                  }
                >
                  <input
                    type="radio"
                    name="outcome"
                    value={o}
                    checked={checked}
                    onChange={() => set('outcome', o)}
                    className="sr-only"
                  />
                  {OUTCOME_STYLE[o].label}
                </label>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs opacity-60">
            No default on purpose. A pre-selected &ldquo;Success&rdquo; gets left on failed prints, and the failure rate is
            what honest costing is built on.
          </p>
          {errors.outcome ? <ErrorText>{errors.outcome}</ErrorText> : null}
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Duration" name="duration" error={errors.duration} help="2h 14m, 2:14, 1.5h, or minutes.">
            <input
              id="duration"
              name="duration"
              type="text"
              inputMode="text"
              autoComplete="off"
              placeholder="2h 14m"
              value={values.duration}
              onChange={(e) => set('duration', e.target.value)}
              className={inputClass}
              aria-invalid={errors.duration ? true : undefined}
            />
          </Field>

          <Field label="Material used" name="material_qty_used" error={errors.material_qty_used}>
            <div className="flex items-center gap-2">
              <input
                id="material_qty_used"
                name="material_qty_used"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="120"
                value={values.material_qty_used}
                onChange={(e) => set('material_qty_used', e.target.value)}
                className={inputClass}
                aria-invalid={errors.material_qty_used ? true : undefined}
              />
              <span className="shrink-0 text-sm opacity-60">{material?.unit ?? 'g'}</span>
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                name="weighed"
                checked={weighed}
                onChange={(e) => setWeighed(e.target.checked)}
                className="h-4 w-4"
              />
              <span>
                Weighed on a scale <span className="opacity-60">(otherwise saved as a slicer estimate)</span>
              </span>
            </label>
          </Field>

          <Field label="Parts on the plate" name="units_produced" error={errors.units_produced}>
            <input
              id="units_produced"
              name="units_produced"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={values.units_produced}
              onChange={(e) => set('units_produced', e.target.value)}
              className={inputClass}
              aria-invalid={errors.units_produced ? true : undefined}
            />
          </Field>

          {outcome === 'partial' ? (
            <Field
              label="Usable parts"
              name="units_good"
              error={errors.units_good}
              help={`Of the ${values.units_produced || '1'} on the plate.`}
            >
              <input
                id="units_good"
                name="units_good"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={values.units_good}
                onChange={(e) => set('units_good', e.target.value)}
                className={inputClass}
                aria-invalid={errors.units_good ? true : undefined}
              />
            </Field>
          ) : null}

          {requiredDefs.map((def) => (
            <ParamInput key={def.key} def={def} value={values[PARAM_PREFIX + def.key] ?? ''} onChange={set} error={errors[PARAM_PREFIX + def.key]} />
          ))}

          <Field label="Project" name="project_id" error={errors.project_id}>
            <select
              id="project_id"
              name="project_id"
              value={values.project_id}
              onChange={(e) => set('project_id', e.target.value)}
              className={inputClass}
            >
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="What was it?" name="title" error={errors.title} help="Optional. Shows in your journal.">
            <input
              id="title"
              name="title"
              type="text"
              maxLength={120}
              placeholder="Dice tower batch"
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      {/* -------------------------------------------------------- defects */}
      <section className="mt-10 border-t border-black/10 pt-6 dark:border-white/15">
        {defectsOpen ? (
          <DefectPicker
            defects={domainDefects}
            selected={defects}
            onChange={setDefects}
            error={errors.defects}
          />
        ) : (
          <button type="button" onClick={() => setShowDefectsOnSuccess(true)} className="text-sm underline underline-offset-2">
            Any defects? (minor stringing on a good print is still worth logging)
          </button>
        )}
      </section>

      {/* ------------------------------------------------- settings used */}
      <section className="mt-8 border-t border-black/10 pt-6 dark:border-white/15">
        <button
          type="button"
          onClick={() => setShowSettings((s) => !s)}
          aria-expanded={settingsOpen}
          className="flex w-full items-center justify-between text-left"
        >
          <span>
            <span className="font-semibold">Settings used</span>
            <span className="ml-2 text-sm opacity-60">
              {filledSettings > 0 ? `${filledSettings} recorded` : 'optional, feeds calibration later'}
            </span>
          </span>
          <span aria-hidden className="text-sm opacity-60">
            {settingsOpen ? 'Hide' : 'Show'}
          </span>
        </button>
        {/* Rendered even when hidden so copied values still submit. */}
        <div className={settingsOpen ? 'mt-6 space-y-8' : 'hidden'}>
          {optionalGroups.map(([group, groupDefs]) => (
            <div key={group}>
              <h3 className="mb-3 text-sm font-semibold opacity-80">{group}</h3>
              <div className="grid gap-5 sm:grid-cols-2">
                {groupDefs.map((def) => (
                  <ParamInput key={def.key} def={def} value={values[PARAM_PREFIX + def.key] ?? ''} onChange={set} error={errors[PARAM_PREFIX + def.key]} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- details */}
      <section className="mt-8 border-t border-black/10 pt-6 dark:border-white/15">
        <button
          type="button"
          onClick={() => setShowDetails((s) => !s)}
          aria-expanded={detailsOpen}
          className="flex w-full items-center justify-between text-left"
        >
          <span>
            <span className="font-semibold">Details</span>
            <span className="ml-2 text-sm opacity-60">finish time, hands-on time, quality, notes</span>
          </span>
          <span aria-hidden className="text-sm opacity-60">
            {detailsOpen ? 'Hide' : 'Show'}
          </span>
        </button>
        <div className={detailsOpen ? 'mt-6 grid gap-5 sm:grid-cols-2' : 'hidden'}>
          <Field label="Finished at" name="completed_at" error={errors.completed_at} help="Blank means now.">
            <input
              id="completed_at"
              type="datetime-local"
              value={values.completed_at}
              onChange={(e) => set('completed_at', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field
            label="Hands-on time"
            name="active_labor_minutes"
            error={errors.active_labor_minutes}
            help="Minutes of your time: setup, removal, cleanup. Not print time."
          >
            <input
              id="active_labor_minutes"
              name="active_labor_minutes"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="10"
              value={values.active_labor_minutes}
              onChange={(e) => set('active_labor_minutes', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Quality" name="quality_rating" error={errors.quality_rating}>
            <select
              id="quality_rating"
              name="quality_rating"
              value={values.quality_rating}
              onChange={(e) => set('quality_rating', e.target.value)}
              className={inputClass}
            >
              <option value="">Not rated</option>
              <option value="5">5: flawless</option>
              <option value="4">4: good</option>
              <option value="3">3: acceptable</option>
              <option value="2">2: poor</option>
              <option value="1">1: unusable</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes" name="notes" error={errors.notes}>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                maxLength={4000}
                value={values.notes}
                onChange={(e) => set('notes', e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-black/10 bg-background/95 backdrop-blur dark:border-white/15">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-foreground px-6 py-3 text-sm font-semibold text-background disabled:opacity-50"
          >
            {pending ? 'Saving...' : 'Save run'}
          </button>
          <Link href="/app/runs" className="text-sm opacity-70 hover:opacity-100">
            Cancel
          </Link>
          {state.status === 'error' ? (
            <p role="alert" className="ml-auto text-sm text-red-600 dark:text-red-400">
              {state.message}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

function Field({
  label,
  name,
  error,
  help,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {help ? <p className="mt-1 text-xs opacity-60">{help}</p> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </div>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-sm text-red-600 dark:text-red-400">{children}</p>;
}

function ParamInput({
  def,
  value,
  onChange,
  error,
}: {
  def: ParamDefRow;
  value: string;
  onChange: (name: string, value: string) => void;
  error?: string;
}) {
  const name = PARAM_PREFIX + def.key;
  const range =
    def.min_value !== null && def.max_value !== null ? `${def.min_value} to ${def.max_value}` : undefined;
  const help = [def.help_text, range && def.unit ? `${range} ${def.unit}` : range].filter(Boolean).join(' ');
  const label = def.is_required ? `${def.display_name} *` : def.display_name;

  let control: React.ReactNode;
  if (def.data_type === 'boolean') {
    control = (
      <select id={name} name={name} value={value} onChange={(e) => onChange(name, e.target.value)} className={inputClass}>
        <option value="">Not recorded</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  } else if (def.data_type === 'enum') {
    control = (
      <select id={name} name={name} value={value} onChange={(e) => onChange(name, e.target.value)} className={inputClass}>
        <option value="">Not recorded</option>
        {(def.enum_options ?? []).map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    );
  } else {
    control = (
      <div className="flex items-center gap-2">
        <input
          id={name}
          name={name}
          type="text"
          inputMode={def.data_type === 'integer' ? 'numeric' : 'decimal'}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          className={inputClass}
          aria-invalid={error ? true : undefined}
        />
        {def.unit ? <span className="shrink-0 text-sm opacity-60">{def.unit}</span> : null}
      </div>
    );
  }

  return (
    <Field label={label} name={name} error={error} help={help || undefined}>
      {control}
    </Field>
  );
}

function DefectPicker({
  defects,
  selected,
  onChange,
  error,
}: {
  defects: RunFormData['defectTypes'];
  selected: Record<number, string>;
  onChange: (next: Record<number, string>) => void;
  error?: string;
}) {
  const process = defects.filter((d) => d.is_process_related);
  const external = defects.filter((d) => !d.is_process_related);

  const toggle = (id: number, on: boolean) => {
    const next = { ...selected };
    if (on) next[id] = next[id] ?? '';
    else delete next[id];
    onChange(next);
  };

  const row = (d: RunFormData['defectTypes'][number]) => {
    const on = d.id in selected;
    return (
      <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
        <label className="flex min-w-0 flex-1 items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="defect"
            value={d.id}
            checked={on}
            onChange={(e) => toggle(d.id, e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            <span className="font-medium">{d.display_name}</span>
            {d.description ? <span className="block text-xs opacity-60">{d.description}</span> : null}
          </span>
        </label>
        {on ? (
          <select
            name={`severity.${d.id}`}
            value={selected[d.id]}
            onChange={(e) => onChange({ ...selected, [d.id]: e.target.value })}
            aria-label={`${d.display_name} severity`}
            className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20"
          >
            <option value="">Severity</option>
            <option value="1">1 barely</option>
            <option value="2">2 minor</option>
            <option value="3">3 noticeable</option>
            <option value="4">4 bad</option>
            <option value="5">5 ruined it</option>
          </select>
        ) : null}
      </li>
    );
  };

  return (
    <div>
      <h2 className="font-semibold">What went wrong?</h2>
      <p className="mt-1 text-sm opacity-65">Tick any that apply. Severity is optional.</p>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">Print defects</h3>
          <ul>{process.map(row)}</ul>
        </div>
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">Not a settings problem</h3>
          <p className="mb-1 text-xs opacity-60">Counted in costs, kept out of calibration.</p>
          <ul>{external.map(row)}</ul>
        </div>
      </div>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </div>
  );
}
