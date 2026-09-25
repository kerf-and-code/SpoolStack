// Illustrations of the app, drawn in HTML instead of screenshots: they stay
// sharp at every size, follow the colour scheme, and never go stale when a
// screen changes, because each one only shows what the feature does.
// Each is one labelled image to assistive tech; the inner text is hidden
// from it so a screen reader hears the label, not a pile of fragments.
//
// The sample run is a real one: a Bambu Studio file from an A1, imported on
// the live app on 2026-09-23 (267 minutes, 135.88 g, 21 settings).

function Frame({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <figure role="img" aria-label={label} className={`site-panel overflow-hidden text-left ${className}`}>
      <div aria-hidden="true">{children}</div>
    </figure>
  );
}

function Bar({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
      <span className="h-2.5 w-2.5 rounded-full bg-ink/20" />
      <span className="h-2.5 w-2.5 rounded-full bg-ink/20" />
      <span className="h-2.5 w-2.5 rounded-full bg-accent" />
      <span className="ml-2 font-mono text-[11px] text-muted">{title}</span>
    </div>
  );
}

function Chip({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'good' | 'warn' | 'bad' }) {
  const tones = {
    plain: 'border-line',
    good: 'border-emerald-600/40 bg-emerald-500/10',
    warn: 'border-amber-600/40 bg-amber-500/10',
    bad: 'border-red-600/40 bg-red-500/10',
  };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${tones[tone]}`}>{children}</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function RunCardMock({ className = '' }: { className?: string }) {
  return (
    <Frame
      label="Example run in SpoolStack: Foot plate, printed on a Bambu Lab A1 in PLA, 4 hours 27 minutes, 135.88 grams, imported from the slicer file."
      className={className}
    >
      <Bar title="spool-stack.com/app/runs" />
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold">Foot plate 2</div>
            <div className="mt-0.5 text-xs text-muted">Bambu Lab A1 / PLA</div>
          </div>
          <Chip tone="good">Success</Chip>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat label="Time" value="4h 27m" />
          <Stat label="Filament" value="135.88 g" />
          <Stat label="Settings" value="21" />
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Chip>Layer 0.20 mm</Chip>
          <Chip>Nozzle 220 °C</Chip>
          <Chip>Bed 65 °C</Chip>
          <Chip>Infill 15%</Chip>
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-line pt-3 font-mono text-[11px] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          imported from Foot_plate_2.gcode.3mf
        </div>
      </div>
    </Frame>
  );
}

export function ImportMock({ className = '' }: { className?: string }) {
  return (
    <Frame
      label="Importing a slicer file: the file is read on the device and the run form fills in print time, filament, temperatures and layer height, and picks the matching printer."
      className={className}
    >
      <Bar title="Log a run" />
      <div className="space-y-3 p-4 sm:p-5">
        <div className="rounded-lg border-2 border-dashed border-line px-4 py-5 text-center">
          <div className="text-sm font-medium">Foot_plate_2.gcode.3mf</div>
          <div className="mt-1 font-mono text-[11px] text-muted">read on this device, never uploaded</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            ['Printer', 'Bambu Lab A1', true],
            ['Time', '4h 27m', true],
            ['Filament', '135.88 g', true],
            ['Material', 'PLA', true],
            ['Layer height', '0.20 mm', true],
            ['Nozzle', '220 °C', true],
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-md border border-line px-2.5 py-1.5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted">{k}</div>
              <div className="font-medium">{v}</div>
            </div>
          ))}
        </div>
        <div className="font-mono text-[11px] text-accent-text">; 21 settings filled from the file</div>
      </div>
    </Frame>
  );
}

export function JournalMock({ className = '' }: { className?: string }) {
  const rows = [
    ['Foot plate 2', 'A1 / PLA', '4h 27m', 'Success', 'good'],
    ['Cable clips x8', 'A1 / PETG', '1h 12m', 'Partial', 'warn'],
    ['Lamp shade', 'A1 / PLA', '6h 40m', 'Failure', 'bad'],
    ['Hinge test', 'A1 / PLA', '0h 22m', 'Success', 'good'],
  ] as const;
  return (
    <Frame
      label="The run journal: a list of runs filtered by machine and material, each with its time and outcome."
      className={className}
    >
      <Bar title="Runs" />
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5">
          <Chip>Machine: A1</Chip>
          <Chip>Material: any</Chip>
          <Chip>Last 30 days</Chip>
        </div>
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line text-sm">
          {rows.map(([title, what, time, outcome, tone]) => (
            <li key={title} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{title}</div>
                <div className="text-xs text-muted">
                  {what} / {time}
                </div>
              </div>
              <Chip tone={tone}>{outcome}</Chip>
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}

export function FailureMock({ className = '' }: { className?: string }) {
  return (
    <Frame
      label="Recording a failure: the outcome, how many parts came out usable, and the defects seen, such as stringing and warping."
      className={className}
    >
      <Bar title="Outcome" />
      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
          {['Success', 'Partial', 'Failure', 'Aborted'].map((o) => (
            <div
              key={o}
              className={
                'rounded-md border px-1 py-1.5 ' +
                (o === 'Partial' ? 'border-ink bg-accent font-semibold text-[#111111]' : 'border-line')
              }
            >
              {o}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Parts on plate" value="8" />
          <Stat label="Usable" value="6" />
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted">Defects</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Chip tone="warn">Stringing / oozing</Chip>
            <Chip tone="warn">Warping / curling</Chip>
            <Chip>Elephant foot</Chip>
            <Chip>Filament ran out</Chip>
          </div>
        </div>
      </div>
    </Frame>
  );
}

export function PresetMock({ className = '' }: { className?: string }) {
  return (
    <Frame
      label="Adding a printer from a preset: picking Bambu Lab P1S fills in the make, model, build volume and nozzle size."
      className={className}
    >
      <Bar title="Add machine" />
      <div className="space-y-3 p-4 sm:p-5 text-sm">
        <div className="rounded-lg border border-line px-3 py-2">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted">Start from a common printer</div>
          <div className="mt-0.5 flex items-center justify-between font-medium">
            Bambu Lab P1S <span className="text-muted">v</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            ['Make', 'Bambu Lab'],
            ['Model', 'P1S'],
            ['Build volume', '256 x 256 x 256 mm'],
            ['Nozzle', '0.4 mm'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md border border-line px-2.5 py-1.5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted">{k}</div>
              <div className="font-medium">{v}</div>
            </div>
          ))}
        </div>
        <div className="font-mono text-[11px] text-muted">; prices and power draw are yours to enter</div>
      </div>
    </Frame>
  );
}

export function CostMock({ className = '' }: { className?: string }) {
  const lines = [
    ['Filament', '135.88 g x $0.020/g', '$2.72'],
    ['Electricity', '4.45 h x 90 W x $0.13/kWh', '$0.05'],
    ['Machine wear', '4.45 h x $0.08/h', '$0.36'],
  ];
  return (
    <Frame
      label="A cost breakdown for one print: filament, electricity and machine wear, with labour marked as not entered rather than counted as zero."
      className={className}
    >
      <Bar title="Cost" />
      <div className="p-4 sm:p-5 text-sm">
        <ul className="space-y-2">
          {lines.map(([k, how, v]) => (
            <li key={k} className="flex items-baseline gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{k}</div>
                <div className="font-mono text-[10px] text-muted">{how}</div>
              </div>
              <div className="tabular-nums">{v}</div>
            </li>
          ))}
          <li className="flex items-baseline gap-3 text-muted">
            <div className="flex-1">Labour</div>
            <Chip tone="warn">rate not entered</Chip>
          </li>
        </ul>
        <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
          <span className="font-semibold">Total so far</span>
          <span className="text-base font-semibold tabular-nums">$3.13</span>
        </div>
      </div>
    </Frame>
  );
}
