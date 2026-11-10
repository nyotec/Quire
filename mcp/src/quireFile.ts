/**
 * Read and write the embedded data block of a single-file Quire wiki.
 *
 * A Quire file stores its state in the FIRST
 *   <script id="quire-data" type="application/json" data-encoding="lz-utf16">…</script>
 * element (in <head>, before the app bundle). The body is JSON compressed with
 * lz-string's UTF-16 codec — the exact encoding the app uses — so files written
 * here open natively in the browser and vice-versa.
 *
 * We replace only the data block's content via a surgical regex, leaving the
 * compiled app shell byte-for-byte intact. Writes are atomic (temp + rename).
 */
import { readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, basename, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import LZString from 'lz-string';
import type { WikiState, Leaf } from './types.js';

export const ENCODING_LZ_UTF16 = 'lz-utf16';
export const ENCODING_PLAIN = 'plain';

/** Matches the first quire-data script: open tag, body, close tag.
 *  Mirrors the app's own replacement regex (no \b after the quote — a quote
 *  followed by a space is not a word boundary). */
const DATA_BLOCK_RE =
  /(<script\s+id="quire-data"[^>]*>)([\s\S]*?)(<\/script>)/;

export class QuireFileError extends Error {
  constructor(
    message: string,
    public code = 'FILE_ERROR',
  ) {
    super(message);
  }
}

export interface ParsedFile {
  /** The full HTML text of the file (app shell + data block). */
  html: string;
  /** The parsed wiki state. */
  state: WikiState;
}

function decode(body: string, encoding: string): string {
  if (encoding === ENCODING_LZ_UTF16) {
    const out = LZString.decompressFromUTF16(body);
    if (out === null) {
      throw new QuireFileError(
        'Failed to decompress the wiki data block (corrupt or wrong encoding).',
        'DECODE_ERROR',
      );
    }
    return out;
  }
  // plain / unknown → raw JSON text
  return body;
}

function encode(json: string): { body: string; encoding: string } {
  return { body: LZString.compressToUTF16(json), encoding: ENCODING_LZ_UTF16 };
}

/** Pull the data block out of an HTML string without parsing JSON. */
export function extractDataBlock(
  html: string,
): { encoding: string; body: string } | null {
  const m = DATA_BLOCK_RE.exec(html);
  if (!m) return null;
  const openTag = m[1];
  const body = m[2];
  const encMatch = /data-encoding="([^"]*)"/.exec(openTag);
  const encoding = encMatch ? encMatch[1] : ENCODING_PLAIN;
  return { encoding, body };
}

/** Parse the HTML of a Quire file into its WikiState. */
export function parseStateFromHtml(html: string): WikiState {
  const block = extractDataBlock(html);
  if (!block) {
    throw new QuireFileError(
      'No <script id="quire-data"> block found — not a Quire file?',
      'NOT_QUIRE_FILE',
    );
  }
  if (!block.body || block.body.trim() === '' || block.body.trim() === '{}') {
    throw new QuireFileError(
      'The Quire file has an empty data block (fresh/unsaved wiki).',
      'EMPTY_WIKI',
    );
  }
  let json: string;
  try {
    json = decode(block.body, block.encoding);
  } catch (err) {
    if (err instanceof QuireFileError) throw err;
    throw new QuireFileError(`Failed to decode data block: ${String(err)}`, 'DECODE_ERROR');
  }
  let state: unknown;
  try {
    state = JSON.parse(json);
  } catch (err) {
    throw new QuireFileError(`Data block is not valid JSON: ${String(err)}`, 'PARSE_ERROR');
  }
  if (
    !state ||
    typeof state !== 'object' ||
    !Array.isArray((state as WikiState).leaves)
  ) {
    throw new QuireFileError('Data block is not a Quire WikiState.', 'PARSE_ERROR');
  }
  return state as WikiState;
}

/** Read and parse a Quire file from disk. */
export async function readWikiFile(path: string): Promise<ParsedFile> {
  let html: string;
  try {
    html = await readFile(path, 'utf-8');
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      throw new QuireFileError(`File not found: ${path}`, 'FILE_NOT_FOUND');
    }
    throw new QuireFileError(`Could not read ${path}: ${String(err)}`, 'READ_ERROR');
  }
  const state = parseStateFromHtml(html);
  return { html, state };
}

/**
 * Produce new HTML with the data block replaced by `state`, preserving the
 * surrounding app shell exactly. Matches the app's own write format so the
 * file remains openable in the browser.
 */
export function embedState(html: string, state: WikiState): string {
  const json = JSON.stringify(state);
  const { body, encoding } = encode(json);
  const openTag = `<script id="quire-data" type="application/json" data-encoding="${encoding}">`;
  if (!DATA_BLOCK_RE.test(html)) {
    throw new QuireFileError(
      'Cannot locate the data block to update — refusing to corrupt the file.',
      'NO_DATA_BLOCK',
    );
  }
  return html.replace(DATA_BLOCK_RE, `${openTag}${body}</script>`);
}

/** Atomically write HTML to `path` (temp file in the same dir + rename). */
export async function writeFileAtomic(path: string, html: string): Promise<void> {
  const dir = dirname(path);
  const tmp = join(dir, `.${basename(path)}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`);
  try {
    await writeFile(tmp, html, 'utf-8');
    await rename(tmp, path);
  } catch (err) {
    throw new QuireFileError(`Atomic write failed for ${path}: ${String(err)}`, 'WRITE_ERROR');
  }
}

// ─── encryption detection ────────────────────────────────────────────────

/**
 * Return a human-readable reason if the wiki carries any encryption the server
 * cannot safely round-trip, otherwise null. Covers master-password protection,
 * per-folder protection, and encrypted (object) leaf bodies.
 */
export function detectEncryption(state: WikiState): string | null {
  if (state.protection && state.protection.mode === 'password') {
    return 'this wiki is protected by a master password';
  }
  const protectedFolder = (state.folders || []).find((f) => f && f.protection);
  if (protectedFolder) {
    return `folder "${protectedFolder.name}" is encrypted`;
  }
  const encLeaf = (state.leaves || []).find(
    (l: Leaf) => l && typeof l.body !== 'string',
  );
  if (encLeaf) {
    return `leaf "${encLeaf.title || encLeaf.id}" has an encrypted body`;
  }
  return null;
}

/** Throw a REFUSED error if the wiki is encrypted and refusal is enabled. */
export function assertNotEncrypted(state: WikiState, refuseEncrypted: boolean): void {
  if (!refuseEncrypted) return;
  const reason = detectEncryption(state);
  if (reason) {
    throw new QuireFileError(
      `Refusing to touch an encrypted wiki: ${reason}. ` +
        `The Quire MCP server does not handle encryption in v1.7 — ` +
        `open the file in Quire and add the note manually.`,
      'ENCRYPTED_REFUSED',
    );
  }
}
