'use client';

// One feature at a time, switched from a list of tabs, rather than a long
// scroll. On narrow screens the tabs become a horizontal strip above the card.
// Follows the WAI-ARIA tabs pattern: arrow keys move between tabs.

import { useRef, useState } from 'react';
import { CostMock, FailureMock, ImportMock, JournalMock, PresetMock } from './mocks';

interface Feature {
  id: string;
  tab: string;
  title: string;
  body: string;
  points: string[];
  status?: 'coming';
  mock: React.ReactNode;
}

const FEATURES: Feature[] = [
  {
    id: 'import',
    tab: 'Slicer import',
    title: 'The slicer already knows. So the form fills itself.',
    body: 'Drop the file you sent to the printer and SpoolStack reads what the slicer wrote into it. Manual entry is always there for jobs with no file.',
    points: [
      '.gcode from PrusaSlicer, OrcaSlicer and Bambu Studio, and sliced .gcode.3mf from Bambu Studio and OrcaSlicer',
      'Print time, filament used, temperatures, layer height and the rest of the settings',
      'Picks your printer and filament when exactly one of yours matches the file',
      'Read on your device. The file is never uploaded',
    ],
    mock: <ImportMock />,
  },
  {
    id: 'journal',
    tab: 'Run journal',
    title: 'Every print, searchable, with the settings that made it.',
    body: 'The log is the product. Every run keeps its printer, filament, project, outcome and every setting, so the good print from three months ago is easy to repeat.',
    points: [
      'Filter by printer, filament, project, outcome and date',
      'Run pages show each setting with its name and unit',
      'Copy from the last run for repeat jobs',
      'Edit or delete any run, any time',
    ],
    mock: <JournalMock />,
  },
  {
    id: 'failures',
    tab: 'Failures',
    title: 'The prints that went wrong are the useful ones.',
    body: 'Most logs only keep the wins. SpoolStack records how a print came out and what went wrong, so your success rate is a measurement, not a feeling.',
    points: [
      'Success, partial, failure or aborted, plus parts made and parts usable',
      '20 defect types, from stringing and warping to layer shifts',
      'Runouts, power cuts and cancels are marked as not the settings’ fault',
    ],
    mock: <FailureMock />,
  },
  {
    id: 'setup',
    tab: 'Quick setup',
    title: 'Your printers and filaments, in a minute.',
    body: 'Start from a common printer or filament type and the physical specs fill in. Anything that depends on you, like what you paid, stays yours to enter.',
    points: [
      '18 common printers from Bambu Lab, Prusa, Creality, Elegoo, Anycubic, QIDI and Sovol',
      '11 filament types with typical densities',
      'No preset prices or power figures: those would be wrong for most people',
    ],
    mock: <PresetMock />,
  },
  {
    id: 'costs',
    tab: 'Honest costs',
    title: 'What each print cost, from your own numbers.',
    body: 'Costs are worked out from what you measured, every time you look, so changing a filament price corrects every past run. The public calculator already uses the same maths.',
    points: [
      'Filament, electricity, machine wear and your time, per print and per part',
      'Failed prints spread over the ones that worked',
      'A missing input is shown as missing, never counted as zero',
    ],
    status: 'coming',
    mock: <CostMock />,
  },
];

export function FeaturesExplorer() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const feature = FEATURES[active];

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = FEATURES.length - 1;
    const next =
      e.key === 'ArrowDown' || e.key === 'ArrowRight'
        ? index === last ? 0 : index + 1
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? index === 0 ? last : index - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_1fr] lg:gap-10">
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="Features"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {FEATURES.map((f, i) => {
          const selected = i === active;
          return (
            <button
              key={f.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              id={`tab-${f.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${f.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={
                'flex shrink-0 items-center gap-3 rounded-lg border-[1.5px] px-3.5 py-2.5 text-left text-sm transition-colors ' +
                (selected
                  ? 'border-ink bg-panel font-semibold shadow-[0_3px_0_0_var(--site-ink)]'
                  : 'border-transparent text-muted hover:border-line hover:text-ink')
              }
            >
              <span className="font-mono text-xs text-accent-text">{String(i + 1).padStart(2, '0')}</span>
              <span className="whitespace-nowrap">{f.tab}</span>
              {f.status === 'coming' ? (
                <span className="rounded-full border border-line px-1.5 py-px font-mono text-[10px] font-normal text-muted">
                  next
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        key={feature.id}
        id={`panel-${feature.id}`}
        role="tabpanel"
        aria-labelledby={`tab-${feature.id}`}
        className="grid gap-8 motion-safe:animate-[fadein_200ms_ease-out] md:grid-cols-[1fr_1fr] md:items-start"
      >
        <div>
          {feature.status === 'coming' ? (
            <p className="mb-3 inline-flex rounded-full border border-line bg-panel px-2.5 py-0.5 font-mono text-[11px] text-muted">
              coming next in the app
            </p>
          ) : null}
          <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{feature.title}</h2>
          <p className="mt-4 text-muted">{feature.body}</p>
          <ul className="mt-6 space-y-2.5 text-sm">
            {feature.points.map((p) => (
              <li key={p} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 h-1 w-3 shrink-0 rounded-full bg-accent" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>{feature.mock}</div>
      </div>
    </div>
  );
}
