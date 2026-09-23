'use client';

// The "Import from slicer file" block at the top of the run form, and the
// summary of what an import filled in. Display only: the run form owns the
// state and does the parsing, because only it can write into the fields.

import { useState } from 'react';
import { formatDuration } from '@/lib/duration';
import { SLICED_FILE_ACCEPT } from '@/lib/gcode-file';
import { formatNumber } from '@/lib/format';

export type MachineStatus =
  | { kind: 'selected'; name: string }
  | { kind: 'kept'; name: string }
  | { kind: 'created'; name: string }
  | { kind: 'ambiguous'; model: string; names: string[] }
  /** current: the machine still selected in the form, which may be this printer under another name. */
  | { kind: 'offer'; model: string; current: string | null }
  | { kind: 'error'; model: string; message: string }
  | { kind: 'none' };

export type MaterialStatus =
  | { kind: 'selected'; name: string }
  | { kind: 'kept'; name: string }
  | { kind: 'ambiguous'; type: string; names: string[] }
  | { kind: 'unmatched'; type: string }
  | { kind: 'none' };

export interface ImportSummary {
  fileName: string;
  plate: string | null;
  slicer: string | null;
  durationMinutes: number | null;
  grams: number | null;
  materialSource: 'stated_grams' | 'from_volume' | 'from_length' | null;
  unit: string;
  settingsFilled: number;
  /** Values outside the dictionary's range. Left blank in the form, never clamped in. */
  outOfRange: { label: string; value: number; range: string }[];
  notes: string[];
  machine: MachineStatus;
  material: MaterialStatus;
  /** JSON for runs.source_metadata. */
  metadataJson: string;
}

const MATERIAL_SOURCE_TEXT: Record<NonNullable<ImportSummary['materialSource']>, string> = {
  stated_grams: "the slicer's weight estimate",
  from_volume: 'estimated from filament volume',
  from_length: 'estimated from filament length',
};

export function ImportPanel({
  importing,
  error,
  summary,
  addingMachine,
  onFile,
  onAddMachine,
}: {
  importing: boolean;
  error: string | null;
  summary: ImportSummary | null;
  addingMachine: boolean;
  onFile: (file: File) => void;
  onAddMachine: (model: string) => void;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      className={
        'mb-4 rounded-lg border border-dashed p-4 ' +
        (dragging ? 'border-foreground bg-black/5 dark:bg-white/10' : 'border-black/25 dark:border-white/25')
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={
            'cursor-pointer rounded-lg border border-black/20 bg-background px-4 py-2 text-sm font-medium ' +
            'hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10 ' +
            (importing ? 'pointer-events-none opacity-50' : '')
          }
        >
          {importing ? 'Reading file...' : summary ? 'Import a different file' : 'Import from slicer file'}
          {/* No name attribute: the file itself is never submitted or uploaded. */}
          <input
            type="file"
            accept={SLICED_FILE_ACCEPT}
            className="sr-only"
            disabled={importing}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ''; // so picking the same file again still fires
              if (file) onFile(file);
            }}
          />
        </label>
        <span className="min-w-0 flex-1 text-sm opacity-70">
          .gcode, or a sliced .gcode.3mf from Bambu Studio or OrcaSlicer. Read on this device, never uploaded.
        </span>
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}

      {summary ? <Summary summary={summary} addingMachine={addingMachine} onAddMachine={onAddMachine} /> : null}
    </div>
  );
}

function Summary({
  summary: s,
  addingMachine,
  onAddMachine,
}: {
  summary: ImportSummary;
  addingMachine: boolean;
  onAddMachine: (model: string) => void;
}) {
  return (
    <div className="mt-4 space-y-3 text-sm">
      <p>
        <span className="font-medium">Imported {s.fileName}</span>
        {s.plate ? <span className="opacity-60"> ({s.plate})</span> : null}
        {s.slicer ? <span className="opacity-60">, sliced in {s.slicer}</span> : null}
      </p>

      <ul className="space-y-1">
        <li>
          <span className="opacity-60">Duration: </span>
          {s.durationMinutes !== null ? formatDuration(s.durationMinutes) : <span className="text-amber-700 dark:text-amber-400">not in the file</span>}
        </li>
        <li>
          <span className="opacity-60">Material: </span>
          {s.grams !== null && s.materialSource ? (
            <>
              {formatNumber(s.grams, 2)} {s.unit}, {MATERIAL_SOURCE_TEXT[s.materialSource]}. Tick &ldquo;Weighed on a
              scale&rdquo; only if you weigh it.
            </>
          ) : (
            <span className="text-amber-700 dark:text-amber-400">not in the file</span>
          )}
        </li>
        <li>
          <span className="opacity-60">Settings: </span>
          {s.settingsFilled} filled in under Settings used
        </li>
        <li>
          <span className="opacity-60">Machine: </span>
          <MachineLine status={s.machine} addingMachine={addingMachine} onAddMachine={onAddMachine} />
        </li>
        <li>
          <span className="opacity-60">Filament: </span>
          <MaterialLine status={s.material} />
        </li>
      </ul>

      {s.outOfRange.length > 0 ? (
        <div role="alert" className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2">
          <p className="font-medium">Left blank because the file&rsquo;s value is outside the allowed range:</p>
          <ul className="mt-1 list-disc pl-5">
            {s.outOfRange.map((o) => (
              <li key={o.label}>
                {o.label}: file says {o.value}, allowed {o.range}. Enter it yourself if it is right.
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {s.notes.length > 0 ? (
        <ul className="list-disc space-y-0.5 pl-5 opacity-80">
          {s.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}

      <p className="text-xs opacity-60">Check the fields below, pick how it went, and save.</p>
    </div>
  );
}

function MachineLine({
  status,
  addingMachine,
  onAddMachine,
}: {
  status: MachineStatus;
  addingMachine: boolean;
  onAddMachine: (model: string) => void;
}) {
  switch (status.kind) {
    case 'selected':
      return <>selected {status.name}</>;
    case 'kept':
      return <>{status.name}, matches the file</>;
    case 'created':
      return (
        <>
          added {status.name}. Fill in its cost fields on the Machines page later for energy and wear cost.
        </>
      );
    case 'ambiguous':
      return (
        <>
          the file says {status.model}, which matches {status.names.join(' and ')}. Pick one below.
        </>
      );
    case 'offer':
      return (
        <>
          the file came from a {status.model}, and none of your machines list that make or model.{' '}
          {status.current ? (
            <>
              If {status.current} (selected below) is that printer, set its model to {status.model} on the Machines
              page so future imports find it. Otherwise,{' '}
            </>
          ) : null}
          <button
            type="button"
            disabled={addingMachine}
            onClick={() => onAddMachine(status.model)}
            className="font-medium underline underline-offset-2 disabled:opacity-50"
          >
            {addingMachine ? 'Adding...' : `${status.current ? 'add' : 'Add'} ${status.model} as a machine`}
          </button>
        </>
      );
    case 'error':
      return <span className="text-red-600 dark:text-red-400">{status.message}</span>;
    default:
      return <span className="opacity-60">the file does not name a printer</span>;
  }
}

function MaterialLine({ status }: { status: MaterialStatus }) {
  switch (status.kind) {
    case 'selected':
      return <>selected {status.name}</>;
    case 'kept':
      return <>{status.name}, matches the file</>;
    case 'ambiguous':
      return (
        <>
          {status.type}: you have {status.names.length} ({status.names.join(', ')}). Pick the spool you used below.
        </>
      );
    case 'unmatched':
      return (
        <>
          the file says {status.type}, and none of your materials have that category. Pick one below, or set a
          material&rsquo;s category to {status.type} so future imports find it.
        </>
      );
    default:
      return <span className="opacity-60">the file does not name a filament type</span>;
  }
}
