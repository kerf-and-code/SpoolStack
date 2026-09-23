'use client';

// Filter bar for the runs list. A GET form, so filters live in the URL: they
// survive a reload, the back button works, and a filtered view can be
// bookmarked. Selects and dates apply as soon as they change.
//
// Dates are the user's local calendar days. The server runs in UTC, so the
// browser's offset is sent along in "tz". It is written in onSubmit, not
// rendered, because a rendered value would differ between the server (UTC)
// and the browser and break hydration.

import Form from 'next/form';
import Link from 'next/link';

export interface FilterOptions {
  machines: { id: string; name: string }[];
  materials: { id: string; name: string }[];
  projects: { id: string; name: string }[];
}

export interface FilterValues {
  outcome: string;
  machine: string;
  material: string;
  project: string;
  from: string;
  to: string;
}

const selectClass =
  'rounded-lg border border-black/15 bg-transparent px-2.5 py-2 text-sm dark:border-white/20 min-w-0';

export function RunFilters({ options, values, active }: { options: FilterOptions; values: FilterValues; active: boolean }) {
  const apply = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => e.currentTarget.form?.requestSubmit();

  return (
    <Form
      action="/app/runs"
      replace
      scroll={false}
      onSubmit={(e) => {
        const tz = e.currentTarget.elements.namedItem('tz');
        if (tz instanceof HTMLInputElement) tz.value = String(new Date().getTimezoneOffset());
      }}
      className="mb-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center"
    >
      <input type="hidden" name="tz" defaultValue="" />
      <select name="outcome" defaultValue={values.outcome} onChange={apply} className={selectClass} aria-label="Outcome">
        <option value="">Any outcome</option>
        <option value="success">Success</option>
        <option value="partial">Partial</option>
        <option value="failure">Failed</option>
        <option value="aborted">Aborted</option>
      </select>
      <select name="machine" defaultValue={values.machine} onChange={apply} className={selectClass} aria-label="Machine">
        <option value="">Any machine</option>
        {options.machines.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <select name="material" defaultValue={values.material} onChange={apply} className={selectClass} aria-label="Material">
        <option value="">Any material</option>
        {options.materials.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {options.projects.length > 0 ? (
        <select name="project" defaultValue={values.project} onChange={apply} className={selectClass} aria-label="Project">
          <option value="">Any project</option>
          {options.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : null}
      <label className="flex items-center gap-1.5 text-sm">
        <span className="opacity-60">From</span>
        <input type="date" name="from" defaultValue={values.from} onChange={apply} className={selectClass} />
      </label>
      <label className="flex items-center gap-1.5 text-sm">
        <span className="opacity-60">To</span>
        <input type="date" name="to" defaultValue={values.to} onChange={apply} className={selectClass} />
      </label>
      {active ? (
        <Link href="/app/runs" className="px-1 text-sm underline underline-offset-2 opacity-70 hover:opacity-100">
          Clear filters
        </Link>
      ) : null}
      {/* For keyboards and no-JS: selects already apply on change. */}
      <button type="submit" className="sr-only">
        Apply filters
      </button>
    </Form>
  );
}
