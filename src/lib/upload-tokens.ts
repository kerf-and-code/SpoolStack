// upload-tokens.ts
// Creating upload tokens for the slicer uploader. Server only (node:crypto).
//
// The token is shown to the user once and never stored: the database keeps
// its SHA-256 hash, which ingest_slice() recomputes with pgcrypto to look the
// token up. A leaked database row therefore cannot be used to upload.

import { createHash, randomBytes } from 'node:crypto';

export const MAX_ACTIVE_TOKENS = 10;

export interface NewToken {
  /** Shown once. "ssk_" plus 43 URL-safe characters. */
  token: string;
  /** Hex SHA-256 of the token, as stored in upload_tokens.token_hash. */
  hash: string;
  /** First characters, shown in the token list so you can tell them apart. */
  prefix: string;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function newUploadToken(): NewToken {
  const token = `ssk_${randomBytes(32).toString('base64url')}`;
  return { token, hash: hashToken(token), prefix: token.slice(0, 10) };
}
