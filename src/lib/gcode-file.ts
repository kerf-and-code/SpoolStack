// Read a sliced file the user picked, in the browser, and return the text the
// gcode parser needs. Nothing is uploaded.
//
// Handles:
//   .gcode / .gco / .g   plain text from any slicer
//   .gcode.3mf / .3mf    Bambu Studio and OrcaSlicer "sliced plate" exports:
//                        a zip holding Metadata/plate_<n>.gcode
// Refuses, with a message saying what to do instead:
//   .bgcode              Prusa binary gcode (compressed blocks, not text)
//   .3mf with no plate   an unsliced project file
//
// Two things keep this fast on a phone with a 100MB file:
//   1. Only the first HEAD_BYTES and last TAIL_BYTES are read. Every slicer
//      puts its metadata at the top (Cura, Bambu header) or the bottom
//      (Prusa, Orca config block). The middle is millions of G1 moves.
//   2. Only comment lines and temperature commands are kept before parsing,
//      which shrinks the text the parser's regexes scan by orders of magnitude.

import { unzipSync } from 'fflate';

export const HEAD_BYTES = 2 * 1024 * 1024;
export const TAIL_BYTES = 4 * 1024 * 1024;
const MAX_ZIP_BYTES = 300 * 1024 * 1024;

/** Every extension and MIME type Android's picker may report for these files. */
export const SLICED_FILE_ACCEPT = [
  '.gcode',
  '.gco',
  '.g',
  '.3mf',
  '.bgcode',
  'text/x-gcode',
  'text/plain',
  'model/3mf',
  'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
  'application/zip',
  'application/x-zip-compressed',
  // Most document providers report gcode as this. Without it the picker
  // greys the files out on Android, the same bug Litmus hit with CSVs.
  'application/octet-stream',
].join(',');

export type SlicedFileResult =
  | {
      ok: true;
      text: string;
      fileName: string;
      kind: 'gcode' | '3mf';
      /** Which plate was read, for multi-plate 3mf exports. */
      plate: string | null;
      notes: string[];
    }
  | { ok: false; message: string };

const decoder = new TextDecoder('utf-8');

/**
 * Keep comment lines (all slicer metadata) and temperature commands (Cura's
 * only record of temperatures). Order is preserved.
 */
export function condenseGcode(text: string): string {
  const keep: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trimStart();
    if (t.startsWith(';') || /^M1(04|09|40|90)\b/i.test(t)) keep.push(t);
  }
  return keep.join('\n');
}

/** Head and tail of a byte array as text, dropping the partial lines at each cut. */
export function headTailText(bytes: Uint8Array, head = HEAD_BYTES, tail = TAIL_BYTES): string {
  if (bytes.length <= head + tail) return decoder.decode(bytes);
  const h = decoder.decode(bytes.subarray(0, head));
  const t = decoder.decode(bytes.subarray(bytes.length - tail));
  return h.slice(0, h.lastIndexOf('\n') + 1) + t.slice(t.indexOf('\n') + 1);
}

async function readHeadTail(file: Blob): Promise<string> {
  if (file.size <= HEAD_BYTES + TAIL_BYTES) {
    return decoder.decode(new Uint8Array(await file.arrayBuffer()));
  }
  const [h, t] = await Promise.all([
    file.slice(0, HEAD_BYTES).arrayBuffer(),
    file.slice(file.size - TAIL_BYTES).arrayBuffer(),
  ]);
  const head = decoder.decode(new Uint8Array(h));
  const tail = decoder.decode(new Uint8Array(t));
  return head.slice(0, head.lastIndexOf('\n') + 1) + tail.slice(tail.indexOf('\n') + 1);
}

function startsWith(bytes: Uint8Array, ascii: string): boolean {
  if (bytes.length < ascii.length) return false;
  for (let i = 0; i < ascii.length; i++) if (bytes[i] !== ascii.charCodeAt(i)) return false;
  return true;
}

export async function readSlicedFile(file: File): Promise<SlicedFileResult> {
  const fileName = file.name;
  const lower = fileName.toLowerCase();
  const magic = new Uint8Array(await file.slice(0, 4).arrayBuffer());

  // Decide by content, not extension: providers rename, and users do too.
  if (startsWith(magic, 'GCDE') || lower.endsWith('.bgcode')) {
    return {
      ok: false,
      message:
        'This is Prusa binary G-code (.bgcode), which cannot be read yet. Turn off binary G-code in ' +
        "PrusaSlicer's printer settings, export again, and import the plain .gcode file.",
    };
  }

  if (startsWith(magic, 'PK\u0003\u0004')) {
    if (file.size > MAX_ZIP_BYTES) {
      return { ok: false, message: 'That 3MF file is over 300 MB, too large to open on this device.' };
    }
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
        // Only inflate plate gcode; thumbnails and meshes are never decompressed.
        filter: (f) => /^Metadata\/plate_\d+\.gcode$/i.test(f.name),
      });
    } catch {
      return { ok: false, message: 'That file looks like a 3MF but could not be opened. It may be damaged.' };
    }
    const plates = Object.keys(entries).sort(
      (a, b) => Number(a.match(/(\d+)\.gcode$/i)?.[1] ?? 0) - Number(b.match(/(\d+)\.gcode$/i)?.[1] ?? 0),
    );
    if (plates.length === 0) {
      return {
        ok: false,
        message:
          'This 3MF has no sliced plate in it, so there is no print time or filament to read. In Bambu ' +
          'Studio or OrcaSlicer, slice first, then use File > Export > Export plate sliced file.',
      };
    }
    const plate = plates[0];
    const notes =
      plates.length > 1
        ? [`This file has ${plates.length} plates. Plate 1 was imported; log the others as separate runs.`]
        : [];
    return {
      ok: true,
      text: condenseGcode(headTailText(entries[plate])),
      fileName,
      kind: '3mf',
      plate: plate.replace(/^Metadata\//, ''),
      notes,
    };
  }

  return { ok: true, text: condenseGcode(await readHeadTail(file)), fileName, kind: 'gcode', plate: null, notes: [] };
}

/** "dice_tower_PLA_2h14m.gcode.3mf" -> "dice tower PLA 2h14m" */
export function titleFromFileName(fileName: string): string {
  return fileName
    .replace(/\.(gcode\.3mf|3mf|bgcode|gcode|gco|g)$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}
