import type { WikiState } from '../types';
import { DEFAULT_AUTOLOCK, DEFAULT_PROTECTION } from '../types';

/** Migrate a v2 WikiState to v3 by adding protection + autolock defaults. */
export function migrateToV3(raw: any): WikiState {
  if (!raw || typeof raw !== 'object') return raw;
  if (raw.schemaVersion === 3 && raw.protection && raw.autolock) return raw;
  const protection = raw.protection || { ...DEFAULT_PROTECTION };
  // Defensive defaults on partial v3 objects
  if (typeof protection.mode !== 'string') protection.mode = 'curtain';
  if (typeof protection.hideIdentifyingInfo !== 'boolean') {
    protection.hideIdentifyingInfo = false;
  }
  const autolock = raw.autolock || { ...DEFAULT_AUTOLOCK };
  if (typeof autolock.inactivityTimeoutMs !== 'number') {
    autolock.inactivityTimeoutMs = DEFAULT_AUTOLOCK.inactivityTimeoutMs;
  }
  if (typeof autolock.hiddenTimeoutMs !== 'number') {
    autolock.hiddenTimeoutMs = DEFAULT_AUTOLOCK.hiddenTimeoutMs;
  }
  return {
    ...raw,
    schemaVersion: 3,
    protection,
    autolock,
  } as WikiState;
}
