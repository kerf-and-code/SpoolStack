// ingest.ts
// What /api/ingest does with an upload, as pure functions so it is tested
// without a server or a database.
//
// The uploader script sends the settings part of a gcode file (comment lines
// from the first 2 MB and last 4 MB). The server parses it with the same
// parser the in-app import uses, so a file logged from the slicer and the
// same file imported by hand produce the same record.

import { condenseGcode } from './gcode-file.ts';
import { parseGcode, type ParsedRun } from './gcodeParse.ts';
import { extractSlicerConfig } from './slicer-config.ts';

/** Upload tokens: "ssk_" plus 43 URL-safe base64 characters (32 random bytes). */
export const UPLOAD_TOKEN_RE = /^ssk_[A-Za-z0-9_-]{40,64}$/;

/** Text the uploader may send. The script keeps comment lines only, so real uploads are far smaller. */
export const INGEST_MAX_TEXT_CHARS = 3_000_000;

export const PARSER_VERSION = 2;

/** The token from "Authorization: Bearer ssk_...", or null. */
export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header);
  if (!m || !UPLOAD_TOKEN_RE.test(m[1])) return null;
  return m[1];
}

/** Just the file's own name, with any folder path and control characters removed. */
export function cleanFileName(raw: unknown): string {
  const s = typeof raw === 'string' ? raw : '';
  const base = s.split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255);
  return cleaned || 'sliced file';
}

/** What ingest_slice() is called with, apart from the token. */
export interface IngestArgs {
  p_file_name: string;
  p_slicer: string | null;
  p_printer_model: string | null;
  p_duration_minutes: number | null;
  p_material_g: number | null;
  p_parsed: StoredParse;
  p_slicer_config: Record<string, string> | null;
}

/** ParsedRun as stored in pending_runs.parsed, with the parser version that produced it. */
export type StoredParse = ParsedRun & { parser_version: number; config_format: string | null; config_skipped: number };

export type IngestResult = { ok: true; args: IngestArgs } | { ok: false; status: number; message: string };

export function buildIngest(body: unknown): IngestResult {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, message: 'Expected a JSON object with file_name and text.' };
  }
  const { file_name, text } = body as { file_name?: unknown; text?: unknown };
  if (typeof text !== 'string' || text.length === 0) {
    return { ok: false, status: 400, message: 'The upload has no gcode text.' };
  }
  if (text.length > INGEST_MAX_TEXT_CHARS) {
    return { ok: false, status: 413, message: 'The upload is too large. Update the uploader script.' };
  }
  if (text.startsWith('GCDE')) {
    return { ok: false, status: 422, message: 'Binary gcode (.bgcode) cannot be read. Turn off binary G-code in the slicer.' };
  }

  // The script already condenses; doing it again is cheap and means an
  // older or hand-rolled client cannot make the parser scan millions of moves.
  const condensed = condenseGcode(text);
  const parsed = parseGcode(condensed);
  const config = extractSlicerConfig(condensed);

  if (!parsed.slicer && parsed.durationMinutes === null && parsed.materialQtyUsedG === null && !config.config) {
    return {
      ok: false,
      status: 422,
      message: 'No slicer settings found in this file, so there is nothing to log. Is it a sliced gcode file?',
    };
  }

  return {
    ok: true,
    args: {
      p_file_name: cleanFileName(file_name),
      p_slicer: parsed.slicer ? parsed.slicer.slice(0, 120) : null,
      p_printer_model: parsed.printerModel ? parsed.printerModel.slice(0, 120) : null,
      p_duration_minutes: parsed.durationMinutes,
      p_material_g: parsed.materialQtyUsedG,
      p_parsed: { ...parsed, parser_version: PARSER_VERSION, config_format: config.format, config_skipped: config.skipped },
      p_slicer_config: config.config,
    },
  };
}

/** Postgres error from ingest_slice() to an HTTP status and a sentence for the uploader's log. */
export function ingestErrorResponse(error: { code?: string; message?: string }): { status: number; message: string } {
  switch (error.code) {
    case '28000':
      return { status: 401, message: 'Upload token not recognised or revoked. Create a new one in SpoolStack, Settings, Slicer uploader.' };
    case '54000':
      return { status: 429, message: 'Too many uploads in the last hour. Try again later.' };
    case '23514':
      return { status: 413, message: 'This file has more settings than SpoolStack can store.' };
    default:
      return { status: 500, message: 'SpoolStack could not save the upload. It will be retried.' };
  }
}
