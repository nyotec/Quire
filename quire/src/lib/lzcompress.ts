import LZString from 'lz-string';

/**
 * Encoding marker for the embedded data block.  Older builds (≤ v1.3) do not
 * carry the `data-encoding` attribute; we treat that as plain JSON.
 */
export type DataEncoding = 'plain' | 'lz-utf16';

export const DATA_ENCODING_ATTR = 'data-encoding';
export const CURRENT_ENCODING: DataEncoding = 'lz-utf16';

/** Compress a JSON string for embedding in the HTML data block. */
export function compress(json: string): string {
  return LZString.compressToUTF16(json);
}

/** Decompress an embedded data block based on its encoding marker. */
export function decompress(raw: string, encoding: DataEncoding | null | undefined): string {
  const e = encoding || 'plain';
  if (e === 'lz-utf16') {
    const out = LZString.decompressFromUTF16(raw);
    if (out === null) throw new Error('Failed to decompress data block (lz-utf16)');
    return out;
  }
  return raw;
}
