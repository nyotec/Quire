/**
 * Centralized schema migration chain.
 *
 * Each migrator is idempotent. The chain is forward-only — older states
 * upgrade through every intermediate version on the way to current.
 *
 * Schema versions:
 *   1 — base (v1)
 *   2 — adds users / authorship (v1.1)
 *   3 — adds protection + autolock (v1.3)
 *   4 — adds folders + per-folder encryption (v1.5)
 *
 * v1.6 introduces the export envelope but does NOT bump schemaVersion —
 * the WikiState shape is unchanged. The envelope wraps a v4 state.
 */
import type { WikiState } from '../types';
import { migrateToV2 } from './users';
import { migrateToV3, migrateToV4 } from './migrate';

export type SchemaVersion = 1 | 2 | 3 | 4;
export const CURRENT_SCHEMA: SchemaVersion = 4;

export interface MigrationResult {
  state: WikiState;
  warnings: string[];
}

/**
 * Migrate a raw input (which may be anywhere from v1 through current) to
 * the current schema. Collects warnings from self-healing.
 */
export function migrateToCurrent(raw: any): MigrationResult {
  const warnings: string[] = [];
  if (!raw || typeof raw !== 'object') {
    throw new Error('Input is not a Quire WikiState object.');
  }
  const startVersion = (raw.schemaVersion ?? 1) as number;
  if (startVersion > CURRENT_SCHEMA) {
    throw new Error(
      `File schema version ${startVersion} is newer than this build (${CURRENT_SCHEMA}).`,
    );
  }

  // Capture console.warn calls so the self-healing in migrateToV4 surfaces
  // as user-visible warnings rather than just dev-tools noise during import.
  const origWarn = console.warn;
  const captured: string[] = [];
  console.warn = (...args: any[]) => {
    captured.push(args.map(String).join(' '));
    origWarn(...args);
  };
  let state: WikiState;
  try {
    state = migrateToV4(migrateToV3(migrateToV2(raw)));
  } finally {
    console.warn = origWarn;
  }
  for (const c of captured) {
    if (c.includes('[quire]')) warnings.push(c.replace(/^\[quire\]\s*/, ''));
  }
  return { state, warnings };
}

/** Test if a parsed object looks like a Quire WikiState. */
export function looksLikeWikiState(x: any): boolean {
  return (
    !!x &&
    typeof x === 'object' &&
    typeof x.schemaVersion === 'number' &&
    Array.isArray(x.leaves)
  );
}
