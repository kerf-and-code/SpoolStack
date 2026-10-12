// Rebuilds public/catalog/filaments.json from the Open Filament Database.
//
//   node scripts/build-filament-catalog.mjs
//
// Source: https://api.openfilamentdatabase.org (MIT licence, rebuilt daily by
// the Open Filament Collective, facilitated by SimplyPrint). Run this whenever
// you want new brands and colours, check the summary it prints, then commit
// the JSON. The app never calls the database's API at run time: the file is
// served by SpoolStack itself and loaded only when the filament picker opens.
//
// Output shape, kept compact because phones download it:
//   { source, licence, generated, counts,
//     brands: [ [brandName, [ [lineName, material, density|null, [ [colourName, "#RRGGBB"], ... ] ], ... ] ], ... ] }
// Discontinued colours and lines are left out.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://api.openfilamentdatabase.org/csv';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'catalog', 'filaments.json');

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0] !== '');
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

async function table(name) {
  const res = await fetch(`${BASE}/${name}.csv`);
  if (!res.ok) throw new Error(`${name}.csv: HTTP ${res.status}`);
  return parseCsv(await res.text());
}

const clean = (s) => s.replace(/\s+/g, ' ').trim();

const [brands, filaments, variants] = await Promise.all([table('brands'), table('filaments'), table('variants')]);

const brandName = new Map(brands.map((b) => [b.id, clean(b.name)]));
const lines = new Map(); // filament id -> { brand, line, material, density, colours: [] }
for (const f of filaments) {
  if (f.discontinued === '1' || !brandName.has(f.brand_id)) continue;
  const density = Number(f.density);
  lines.set(f.id, {
    brand: brandName.get(f.brand_id),
    line: clean(f.name),
    material: clean(f.material).toUpperCase(),
    density: Number.isFinite(density) && density > 0 && density < 25 ? Math.round(density * 1000) / 1000 : null,
    colours: [],
  });
}

let colourCount = 0;
for (const v of variants) {
  const line = lines.get(v.filament_id);
  if (!line || v.discontinued === '1') continue;
  const hex = v.color_hex.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(hex)) continue;
  line.colours.push([clean(v.name), hex]);
  colourCount++;
}

const byBrand = new Map();
for (const l of lines.values()) {
  if (l.colours.length === 0) continue;
  l.colours.sort((a, b) => a[0].localeCompare(b[0]));
  const list = byBrand.get(l.brand) ?? [];
  list.push([l.line, l.material, l.density, l.colours]);
  byBrand.set(l.brand, list);
}
const out = [...byBrand.entries()]
  .sort((a, b) => a[0].localeCompare(b[0], 'en', { sensitivity: 'base' }))
  .map(([brand, list]) => [brand, list.sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]))]);

const counts = {
  brands: out.length,
  lines: out.reduce((n, [, l]) => n + l.length, 0),
  colours: colourCount,
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify({
    source: 'Open Filament Database, https://openfilamentdatabase.org',
    licence: 'MIT, see https://github.com/OpenFilamentCollective/open-filament-database',
    generated: new Date().toISOString().slice(0, 10),
    counts,
    brands: out,
  }),
);
console.log(`Wrote ${OUT}`);
console.log(`${counts.brands} brands, ${counts.lines} filament lines, ${counts.colours} colours`);
