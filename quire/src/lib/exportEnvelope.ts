import type { WikiState } from '../types';

export const EXPORT_FORMAT = 'quire-export';
export const EXPORT_VERSION = 1;

export interface ExportEnvelope {
  format: typeof EXPORT_FORMAT;
  exportVersion: number;
  exportedAt: string;
  exportedBy: string;
  wikiId: string;
  schemaVersion: number;
  data: WikiState;
}

const BUILD_VERSION = 'quire 1.6.0';

/** Wrap a WikiState in the self-describing envelope. */
export function wrapInEnvelope(state: WikiState): ExportEnvelope {
  return {
    format: EXPORT_FORMAT,
    exportVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: BUILD_VERSION,
    wikiId: state.wikiId,
    schemaVersion: state.schemaVersion,
    data: state,
  };
}

/**
 * Pull a WikiState out of an arbitrary parsed JSON value.  Accepts both the
 * v1.6 envelope and pre-v1.6 raw exports (which had the WikiState at the
 * top level).  Throws on shapes we don't recognise or on too-new envelopes.
 */
export function unwrapEnvelope(parsed: any): WikiState {
  if (
    parsed &&
    typeof parsed === 'object' &&
    parsed.format === EXPORT_FORMAT
  ) {
    if (typeof parsed.exportVersion !== 'number') {
      throw new Error('This file is not a Quire export.');
    }
    if (parsed.exportVersion > EXPORT_VERSION) {
      throw new Error('This file uses an unsupported export format version.');
    }
    if (!parsed.data || typeof parsed.data !== 'object') {
      throw new Error('This file is not a Quire export.');
    }
    return parsed.data as WikiState;
  }
  // Pre-v1.6 raw export — top-level object IS the WikiState.
  return parsed as WikiState;
}
