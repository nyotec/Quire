import type { WikiState } from '../types';
import { unwrapEnvelope } from './exportEnvelope';
import {
  CURRENT_SCHEMA,
  looksLikeWikiState,
  migrateToCurrent,
  MigrationResult,
} from './migrations';

export interface ParseResult extends MigrationResult {
  /** Was the input wrapped in the v1.6 envelope? */
  wrappedInEnvelope: boolean;
  /** Source's schemaVersion before migration, for diagnostics. */
  sourceVersion: number;
}

/**
 * Parse, unwrap, validate, migrate.  Throws with a human-readable message
 * on any of the well-defined failure modes.
 */
export function parseImportJSON(text: string): ParseResult {
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('This file is not valid JSON.');
  }
  const wrapped =
    !!parsed && typeof parsed === 'object' && parsed.format === 'quire-export';
  const inner = unwrapEnvelope(parsed);
  if (!looksLikeWikiState(inner)) {
    throw new Error('This file is not a Quire export.');
  }
  if ((inner.schemaVersion as number) > CURRENT_SCHEMA) {
    throw new Error(
      'This file is from a newer version of Quire than this build supports.',
    );
  }
  const result = migrateToCurrent(inner);
  return {
    state: result.state,
    warnings: result.warnings,
    wrappedInEnvelope: wrapped,
    sourceVersion: (inner.schemaVersion as number) ?? 1,
  };
}

/** Read a File via FileReader and return its text. */
export function readJSONFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}

export type { WikiState };
