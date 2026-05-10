import type { WikiState, Folder, FolderID } from '../types';
import { DEFAULT_AUTOLOCK, DEFAULT_PROTECTION } from '../types';

/** Migrate a v2 WikiState to v3 by adding protection + autolock defaults. */
export function migrateToV3(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  if (raw.schemaVersion >= 3 && raw.protection && raw.autolock) return raw;
  const protection = raw.protection || { ...DEFAULT_PROTECTION };
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
    schemaVersion: Math.max(raw.schemaVersion || 0, 3),
    protection,
    autolock,
  };
}

/**
 * Migrate v3 → v4: add folders array (empty), set every leaf's folderId to null.
 * Self-heals broken parentId / folderId references on load.
 */
export function migrateToV4(raw: any): WikiState {
  const v3 = migrateToV3(raw);
  if (!v3 || typeof v3 !== 'object') return v3;
  if (v3.schemaVersion === 4 && Array.isArray(v3.folders)) {
    return selfHealFolders(v3);
  }
  const folders: Folder[] = Array.isArray(v3.folders) ? v3.folders : [];
  const leaves = (v3.leaves || []).map((l: any) => ({
    ...l,
    folderId: l.folderId ?? null,
  }));
  return selfHealFolders({
    ...v3,
    schemaVersion: 4,
    folders,
    leaves,
  });
}

/** Detect cycles, missing parents/folders; mend the data without throwing. */
function selfHealFolders(state: any): WikiState {
  const folders: Folder[] = state.folders || [];
  const ids = new Set<FolderID>(folders.map((f) => f.id));

  // Repair parentId references.  parentId pointing to a missing folder → null.
  for (const f of folders) {
    if (f.parentId && !ids.has(f.parentId)) {
      console.warn('[quire] folder parentId references missing folder; treating as root', f.id);
      f.parentId = null;
    }
  }

  // Detect cycles via simple DFS climbing parent chain with a guard depth.
  for (const f of folders) {
    let cur: Folder | undefined = f;
    const seen = new Set<FolderID>();
    let depth = 0;
    while (cur && cur.parentId && depth < 1024) {
      if (seen.has(cur.id)) {
        console.warn('[quire] folder cycle detected; breaking at', f.id);
        f.parentId = null;
        break;
      }
      seen.add(cur.id);
      cur = folders.find((g) => g.id === cur!.parentId);
      depth++;
    }
  }

  // Repair leaf folderId references.
  for (const l of state.leaves || []) {
    if (l.folderId && !ids.has(l.folderId)) {
      console.warn('[quire] leaf folderId references missing folder; treating as unfiled', l.id);
      l.folderId = null;
    }
  }
  return state as WikiState;
}
