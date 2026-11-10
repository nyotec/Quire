/**
 * Helpers for inspecting and mutating a parsed WikiState: folder resolution,
 * tag/topic summaries, and a fresh empty-state factory for create_file.
 */
import { randomUUID } from 'node:crypto';
import type { WikiState, Folder, Leaf } from './types.js';
import { CURRENT_SCHEMA } from './types.js';

/** Default settings mirroring the app's DEFAULT_SETTINGS. */
function defaultSettings(): WikiState['settings'] {
  return {
    theme: 'paper',
    accent: 'ochre',
    fontPair: 'editorial',
    density: 'regular',
    layout: 'river',
    sidebar: true,
    backlinks: true,
    spineNumbers: true,
    plugins: {
      backlinks: true,
      graph: false,
      math: false,
      code: true,
      wordcount: false,
      darkjournal: false,
    },
    tasks: { showOverdueBadge: true, dateFormat: 'relative' },
    showAuthorAttribution: false,
  };
}

/** A brand-new empty wiki state (used when creating a file). */
export function createEmptyState(): WikiState {
  const now = new Date().toISOString();
  return {
    schemaVersion: CURRENT_SCHEMA,
    wikiId: `wiki-${randomUUID()}`,
    leaves: [],
    openIds: [],
    focusedId: null,
    settings: defaultSettings(),
    lastSaved: now,
    users: [],
    protection: { mode: 'curtain', hideIdentifyingInfo: false },
    autolock: { inactivityTimeoutMs: 5 * 60 * 1000, hiddenTimeoutMs: 30 * 1000 },
    folders: [],
  };
}

/**
 * Resolve a folder by id or (case-insensitive) name. When `createIfMissing`
 * and the name doesn't match, a new top-level folder is appended. Returns null
 * when no folder is requested.
 */
export function resolveFolder(
  state: WikiState,
  folderRef: string | undefined,
  createIfMissing: boolean,
): { folderId: string; created: boolean } | null {
  if (!folderRef || !folderRef.trim()) return null;
  const ref = folderRef.trim();
  if (!Array.isArray(state.folders)) state.folders = [];

  const byId = state.folders.find((f) => f.id === ref);
  if (byId) return { folderId: byId.id, created: false };

  const byName = state.folders.find(
    (f) => f.name.toLowerCase() === ref.toLowerCase(),
  );
  if (byName) return { folderId: byName.id, created: false };

  if (!createIfMissing) {
    throw new Error(
      `No folder named "${ref}". Existing folders: ` +
        (state.folders.map((f) => f.name).join(', ') || '(none)'),
    );
  }

  const folder: Folder = {
    id: `folder-${randomUUID()}`,
    name: ref,
    parentId: null,
    created: new Date().toISOString(),
  };
  state.folders.push(folder);
  return { folderId: folder.id, created: true };
}

/** Build a path-style label for a folder (Parent / Child). */
export function folderPath(state: WikiState, folderId: string | null | undefined): string {
  if (!folderId) return '';
  const byId = new Map(state.folders.map((f) => [f.id, f] as const));
  const parts: string[] = [];
  let cur = byId.get(folderId);
  let guard = 0;
  while (cur && guard++ < 64) {
    parts.unshift(cur.name);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return parts.join(' / ');
}

export interface FolderSummary {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  leafCount: number;
  encrypted: boolean;
}

/** Summaries of every folder with per-folder leaf counts. */
export function summarizeFolders(state: WikiState): FolderSummary[] {
  const counts = new Map<string, number>();
  for (const l of state.leaves) {
    if (l.folderId) counts.set(l.folderId, (counts.get(l.folderId) || 0) + 1);
  }
  return (state.folders || []).map((f) => ({
    id: f.id,
    name: f.name,
    path: folderPath(state, f.id),
    parentId: f.parentId,
    leafCount: counts.get(f.id) || 0,
    encrypted: !!f.protection,
  }));
}

/** Top tags across the wiki, most-frequent first. */
export function collectTags(state: WikiState, limit = 50): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const l of state.leaves) {
    for (const t of l.tags || []) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}

/** Plain-text body for search/snippets (encrypted bodies yield ''). */
export function bodyText(leaf: Leaf): string {
  return typeof leaf.body === 'string' ? leaf.body : '';
}
