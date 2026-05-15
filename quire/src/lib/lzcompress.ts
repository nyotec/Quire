import LZString from 'lz-string';

/**
 * Encoding marker for the embedded data block.  Older builds (≤ v1.3) do not
 * carry the `data-encoding` attribute; we treat that as plain JSON.
 *
 * Encoding constants live in this single file so both the save and load
 * paths can reference them — making encoding-mismatch bugs impossible.
 */
export const ENCODING_LZ_UTF16 = 'lz-utf16';
export const ENCODING_PLAIN = 'plain';

export type DataEncoding = typeof ENCODING_LZ_UTF16 | typeof ENCODING_PLAIN;

export const DATA_ENCODING_ATTR = 'data-encoding';
export const CURRENT_ENCODING: DataEncoding = ENCODING_LZ_UTF16;

/** Compress a JSON string for embedding in the HTML data block. */
export function compress(json: string): string {
  return LZString.compressToUTF16(json);
}

/** Decompress an embedded data block based on its encoding marker. */
export function decompress(raw: string, encoding: string | null | undefined): string {
  if (encoding === ENCODING_LZ_UTF16) {
    const out = LZString.decompressFromUTF16(raw);
    if (out === null) {
      throw new Error('LZ decompression failed (returned null)');
    }
    return out;
  }
  // plain or null/undefined: treat as raw JSON text
  return raw;
}

/** Encode a state into { body, encoding } ready for embedding. */
export function encodeStateBody(json: string): { body: string; encoding: DataEncoding } {
  return { body: compress(json), encoding: CURRENT_ENCODING };
}
