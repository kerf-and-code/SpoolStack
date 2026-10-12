'use client';

// Brand, then filament line, then a colour swatch, from the public filament
// list (Open Filament Database). Used on Add material and inside the run form.
// The list downloads only when this opens (about 110 KB compressed).

import { useEffect, useMemo, useState } from 'react';
import { loadCatalog, type CatalogPick, type FilamentCatalog } from '@/lib/filament-catalog';

const selectClass =
  'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-base sm:text-sm outline-none ' +
  'focus:border-black/40 dark:border-white/20 dark:focus:border-white/50';

/** Light colours need a dark ring to be visible against the page. */
function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 200;
}

export function Swatch({ hex, size = 'h-4 w-4' }: { hex: string | null | undefined; size?: string }) {
  if (!hex) return null;
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full border ${size} ${isLight(hex) ? 'border-black/30' : 'border-black/10 dark:border-white/20'}`}
      style={{ backgroundColor: hex }}
    />
  );
}

export function FilamentCatalogPicker({
  onPick,
  busy = false,
  preferredBrands = [],
  footer,
}: {
  onPick: (pick: CatalogPick) => void;
  /** True while the pick is being saved. */
  busy?: boolean;
  /** Brands to list first, such as the ones you already own. */
  preferredBrands?: string[];
  /** Shown under the swatches, e.g. a link to type a filament in by hand. */
  footer?: React.ReactNode;
}) {
  const [catalog, setCatalog] = useState<FilamentCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState('');
  const [lineIndex, setLineIndex] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let live = true;
    loadCatalog()
      .then((c) => {
        if (live) setCatalog(c);
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : 'The filament list did not load.');
      });
    return () => {
      live = false;
    };
  }, []);

  const brandNames = useMemo(() => {
    if (!catalog) return null;
    const all = catalog.brands.map(([b]) => b);
    const preferred = all.filter((b) => preferredBrands.some((p) => p.toLowerCase() === b.toLowerCase()));
    return { preferred, all };
  }, [catalog, preferredBrands]);

  const lines = useMemo(() => catalog?.brands.find(([b]) => b === brand)?.[1] ?? [], [catalog, brand]);
  const line = lineIndex === '' ? null : (lines[Number(lineIndex)] ?? null);
  const colours = useMemo(() => {
    if (!line) return [];
    const q = query.trim().toLowerCase();
    return q ? line[3].filter(([name]) => name.toLowerCase().includes(q)) : line[3];
  }, [line, query]);

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {error} Check your connection and try again, or add the filament by hand.
      </p>
    );
  }
  if (!catalog || !brandNames) {
    return <p className="text-sm opacity-60">Loading the filament list...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="catalog-brand" className="mb-1.5 block text-sm font-medium">
            Brand
          </label>
          <select
            id="catalog-brand"
            value={brand}
            onChange={(e) => {
              setBrand(e.target.value);
              setLineIndex('');
              setQuery('');
            }}
            className={selectClass}
          >
            <option value="">Choose a brand</option>
            {brandNames.preferred.length > 0 ? (
              <optgroup label="Brands you use">
                {brandNames.preferred.map((b) => (
                  <option key={`p-${b}`} value={b}>
                    {b}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label="All brands">
              {brandNames.all.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <div>
          <label htmlFor="catalog-line" className="mb-1.5 block text-sm font-medium">
            Type
          </label>
          <select
            id="catalog-line"
            value={lineIndex}
            disabled={!brand}
            onChange={(e) => {
              setLineIndex(e.target.value);
              setQuery('');
            }}
            className={selectClass + ' disabled:opacity-50'}
          >
            <option value="">{brand ? 'Choose a filament' : 'Choose a brand first'}</option>
            {lines.map(([name, material, , cols], i) => (
              <option key={`${name}-${i}`} value={String(i)}>
                {name.toUpperCase().includes(material) ? name : `${name} (${material})`}, {cols.length}{' '}
                {cols.length === 1 ? 'colour' : 'colours'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {line ? (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">Colour</span>
            {line[3].length > 12 ? (
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a colour"
                aria-label="Find a colour"
                className="w-44 rounded-lg border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/20"
              />
            ) : null}
          </div>
          <ul className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {colours.map(([name, hex]) => (
              <li key={`${name}-${hex}`}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    onPick({ brand, line: line[0], material: line[1], density: line[2], colourName: name, hex })
                  }
                  className="flex w-full items-center gap-2.5 rounded-lg border border-black/10 px-3 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
                >
                  <Swatch hex={hex} size="h-6 w-6" />
                  <span className="min-w-0 break-words">{name}</span>
                </button>
              </li>
            ))}
          </ul>
          {colours.length === 0 ? <p className="text-sm opacity-60">No colour by that name.</p> : null}
        </div>
      ) : null}

      <div className="text-xs opacity-60">
        {busy ? <p className="font-medium opacity-100">Adding...</p> : null}
        {footer}
        <p className="mt-1">
          Filament list from the Open Filament Database (MIT licence), {catalog.counts.brands} brands and{' '}
          {catalog.counts.colours.toLocaleString()} colours, updated {catalog.generated}. Colours are the maker&rsquo;s
          own swatches and may look different on your screen.
        </p>
      </div>
    </div>
  );
}
