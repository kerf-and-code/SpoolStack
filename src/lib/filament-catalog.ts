// filament-catalog.ts
// The public filament list (brand, filament line, type, colours with hex
// codes) and how a pick from it becomes one of your materials.
//
// The data is public/catalog/filaments.json, built from the Open Filament
// Database (MIT) by scripts/build-filament-catalog.mjs. It is fetched only
// when a picker opens, and never at build or server time.
//
// Same rule as the printer presets: a pick copies physical facts (brand,
// type, colour, density, 1.75 mm). Never a price: prices go stale and differ
// by seller, and a wrong price is a confidently wrong cost.

export const CATALOG_URL = '/catalog/filaments.json';

export type CatalogColour = [name: string, hex: string];
export type CatalogLine = [line: string, material: string, density: number | null, colours: CatalogColour[]];
export type CatalogBrand = [brand: string, lines: CatalogLine[]];

export interface FilamentCatalog {
  source: string;
  licence: string;
  generated: string;
  counts: { brands: number; lines: number; colours: number };
  brands: CatalogBrand[];
}

/** One colour of one filament line, as picked. */
export interface CatalogPick {
  brand: string;
  line: string;
  material: string;
  density: number | null;
  colourName: string;
  hex: string;
}

/** The material row a pick becomes. Cost fields are left blank on purpose. */
export interface MaterialFromCatalog {
  name: string;
  category: string;
  brand: string;
  color: string;
  color_hex: string;
  density_g_cm3: number | null;
  diameter_mm: number;
  unit: 'g';
  domain_id: 'fdm';
}

let cached: Promise<FilamentCatalog> | null = null;

/** Browser only. One download per page load; a failed download can be retried. */
export function loadCatalog(): Promise<FilamentCatalog> {
  if (!cached) {
    cached = fetch(CATALOG_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`The filament list did not load (HTTP ${r.status}).`);
        return r.json() as Promise<FilamentCatalog>;
      })
      .catch((e) => {
        cached = null;
        throw e;
      });
  }
  return cached;
}

const squash = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** "#9d2235", "9D2235", "#9D2235FF" or "#9D2235;#FFFFFF" (multi-material) -> "#9D2235". */
export function normHex(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(/[;,]/)[0].replace(/["'\s]/g, '');
  const m = /^#?([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?$/.exec(first);
  return m ? `#${m[1].toUpperCase()}` : null;
}

/** "Prusament" + "Prusament PLA" + "Galaxy Black" -> "Prusament PLA Galaxy Black", without the brand twice. */
export function materialFromPick(p: CatalogPick): MaterialFromCatalog {
  const line = squash(p.line).startsWith(squash(p.brand)) ? p.line : `${p.brand} ${p.line}`;
  const name = `${line} ${p.colourName}`.replace(/\s+/g, ' ').trim().slice(0, 100);
  return {
    name,
    category: p.material.slice(0, 40),
    brand: p.brand.slice(0, 80),
    color: p.colourName.slice(0, 60),
    color_hex: p.hex,
    density_g_cm3: p.density,
    diameter_mm: 1.75,
    unit: 'g',
    domain_id: 'fdm',
  };
}

/** What a sliced file says about its filament, read from the slicer settings. */
export interface FilamentHint {
  vendor: string | null;
  settingsId: string | null;
  type: string | null;
  hex: string | null;
}

const unquote = (v: string | undefined) => (v ? v.replace(/^"+|"+$/g, '').split(';')[0].trim() || null : null);

/**
 * Bambu Studio, OrcaSlicer and PrusaSlicer all write filament_vendor,
 * filament_settings_id, filament_type and filament_colour. Multi-material
 * files list one per slot; the first slot is used, matching the importer.
 */
export function filamentHintFromConfig(config: Record<string, string> | null | undefined): FilamentHint | null {
  if (!config) return null;
  const hint: FilamentHint = {
    vendor: unquote(config.filament_vendor),
    settingsId: unquote(config.filament_settings_id),
    type: unquote(config.filament_type),
    hex: normHex(config.filament_colour),
  };
  return hint.hex ? hint : null;
}

/**
 * The catalog colour a file's filament most likely is, or null when it is not
 * certain. Needs the colour; narrows by vendor, type and the profile name
 * ("Bambu PLA Basic @BBL A1" names the PLA Basic line). A colour that two
 * lines share, with nothing to tell them apart, is not guessed.
 */
export function findCatalogMatch(catalog: FilamentCatalog, hint: FilamentHint): CatalogPick | null {
  if (!hint.hex) return null;
  const vendor = squash(hint.vendor);
  const profile = squash(hint.settingsId);
  const type = squash(hint.type);

  const brands = vendor
    ? catalog.brands.filter(([b]) => {
        const s = squash(b);
        return s === vendor || (s.length >= 4 && (vendor.includes(s) || s.includes(vendor)));
      })
    : catalog.brands;

  const hits: { pick: CatalogPick; score: number }[] = [];
  for (const [brand, lines] of brands) {
    for (const [line, material, density, colours] of lines) {
      if (type && squash(material) !== type) continue;
      const colour = colours.find(([, hex]) => hex === hint.hex);
      if (!colour) continue;
      // A line named in the profile ("PLA Basic" in "Bambu PLA Basic @BBL A1") scores by how much of it matched.
      const lineKey = squash(line.replace(new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ''));
      const score = profile && lineKey && profile.includes(lineKey) ? lineKey.length : 0;
      hits.push({ pick: { brand, line, material, density, colourName: colour[0], hex: colour[1] }, score });
    }
  }
  if (hits.length === 0) return null;
  hits.sort((a, b) => b.score - a.score);
  if (hits.length === 1) return hits[0].pick;
  // Several lines share the colour: only a profile-name match settles it.
  if (hits[0].score > 0 && hits[0].score > hits[1].score) return hits[0].pick;
  return null;
}
