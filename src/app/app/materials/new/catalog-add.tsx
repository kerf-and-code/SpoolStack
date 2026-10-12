'use client';

// "Pick from the filament list" on the Add material page: one pick adds the
// filament and opens it, so the only thing left to type is the price.

import { useState, useTransition } from 'react';
import { FilamentCatalogPicker } from '@/components/filament-catalog-picker';
import type { CatalogPick } from '@/lib/filament-catalog';
import { addMaterialFromCatalogAndOpen } from '../actions';

export function CatalogAdd({ preferredBrands }: { preferredBrands: string[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(p: CatalogPick) {
    setError(null);
    startTransition(async () => {
      // Redirects on success; only a failure comes back.
      const r = await addMaterialFromCatalogAndOpen(p);
      if (r && !r.ok) setError(r.message);
    });
  }

  return (
    <section className="mb-8 rounded-xl border border-black/10 p-4 dark:border-white/15">
      <h2 className="font-semibold">Pick from the filament list</h2>
      <p className="mt-1 mb-4 text-sm opacity-65">
        Brand, type and colour. Fills in everything except the price, and lets an imported file find this spool by its
        colour.
      </p>
      <FilamentCatalogPicker onPick={pick} busy={pending} preferredBrands={preferredBrands} />
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
