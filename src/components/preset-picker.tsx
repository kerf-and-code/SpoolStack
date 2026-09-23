'use client';

// "Start from a preset" picker for the add-machine and add-material pages.
// A GET form, so the chosen preset lives in the URL as ?preset=: the server
// page reads it and pre-fills the form below. Choosing applies at once; the
// button is there for keyboards and for anyone who prefers to confirm.
//
// The page keys the entity form on the preset id, so switching presets
// remounts it with the new defaults instead of keeping stale typed values.

import Form from 'next/form';
import Link from 'next/link';

export interface PresetGroup {
  label: string;
  options: { value: string; label: string }[];
}

export function PresetPicker({
  action,
  groups,
  value,
  label,
  note,
}: {
  /** The page's own path, e.g. /app/machines/new. */
  action: string;
  groups: PresetGroup[];
  /** The preset currently applied, or '' for none. */
  value: string;
  label: string;
  note: string;
}) {
  return (
    <Form
      action={action}
      replace
      scroll={false}
      className="mb-8 rounded-xl border border-black/10 p-4 dark:border-white/15"
    >
      <label htmlFor="preset" className="block text-sm font-medium">
        {label}
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          id="preset"
          name="preset"
          defaultValue={value}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="min-w-0 flex-1 rounded-lg border border-black/15 bg-transparent px-2.5 py-2 text-sm dark:border-white/20"
        >
          <option value="">Start blank</option>
          {groups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-black/15 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Fill in
        </button>
        {value ? (
          <Link href={action} replace scroll={false} className="text-sm opacity-60 hover:opacity-100">
            Clear
          </Link>
        ) : null}
      </div>
      <p className="mt-2 text-xs opacity-60">{note}</p>
    </Form>
  );
}
