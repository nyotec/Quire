import type { Folder, FolderID, Leaf, LeafID, WikiState } from '../types';

export type LeafResolution = 'keep-yours' | 'keep-theirs' | 'keep-both';
export type FolderResolution = 'merge' | 'rename-theirs';
export type TitleResolution = 'rename-theirs' | 'rename-yours' | 'keep-both-as-is';

export interface LeafConflict {
  kind: 'leaf-id';
  id: LeafID;
  yours: Leaf;
  theirs: Leaf;
  resolution: LeafResolution;
}

export interface FolderConflict {
  kind: 'folder-name';
  /** ID of the imported folder (theirs). */
  theirsId: FolderID;
  /** ID of the existing folder (yours). */
  yoursId: FolderID;
  name: string;
  parentId: FolderID | null;
  yoursLeafCount: number;
  theirsLeafCount: number;
  resolution: FolderResolution;
}

export interface TitleConflict {
  kind: 'title';
  yours: Leaf;
  theirs: Leaf;
  resolution: TitleResolution;
}

export type Conflict = LeafConflict | FolderConflict | TitleConflict;

export interface ConflictReport {
  conflicts: Conflict[];
  /** Imported leaves that have no collision with existing wiki. Always added on apply. */
  freshLeaves: Leaf[];
  /** Imported folders that have no name+parent collision. Always added on apply. */
  freshFolders: Folder[];
  /** Imported users whose IDs aren't already in the current wiki. Always added on apply. */
  freshUsers: WikiState['users'];
}

/**
 * Detect conflicts between an imported state (`theirs`) and the current
 * wiki (`yours`).  Pure function — no side effects.
 */
export function detectConflicts(yours: WikiState, theirs: WikiState): ConflictReport {
  const conflicts: Conflict[] = [];
  const yoursLeafById = new Map(yours.leaves.map((l) => [l.id, l] as const));
  const yoursLeafByTitle = new Map(
    yours.leaves.map((l) => [l.title.toLowerCase(), l] as const),
  );
  const yoursFolderKey = (f: Folder) =>
    `${f.parentId || ''}::${f.name.toLowerCase()}`;
  const yoursFolderByKey = new Map(
    yours.folders.map((f) => [yoursFolderKey(f), f] as const),
  );
  const yoursUserIds = new Set(yours.users.map((u) => u.id));

  // Leaf ID collisions
  const theirLeavesById = new Map(theirs.leaves.map((l) => [l.id, l] as const));
  for (const l of theirs.leaves) {
    const yoursLeaf = yoursLeafById.get(l.id);
    if (yoursLeaf) {
      conflicts.push({
        kind: 'leaf-id',
        id: l.id,
        yours: yoursLeaf,
        theirs: l,
        resolution: 'keep-yours',
      });
    }
  }

  // Folder name collisions (same name + same parent)
  for (const f of theirs.folders) {
    const key = yoursFolderKey(f);
    const yoursFolder = yoursFolderByKey.get(key);
    if (yoursFolder) {
      const yoursCount = yours.leaves.filter((l) => l.folderId === yoursFolder.id).length;
      const theirsCount = theirs.leaves.filter((l) => l.folderId === f.id).length;
      conflicts.push({
        kind: 'folder-name',
        theirsId: f.id,
        yoursId: yoursFolder.id,
        name: f.name,
        parentId: f.parentId,
        yoursLeafCount: yoursCount,
        theirsLeafCount: theirsCount,
        resolution: 'merge',
      });
    }
  }

  // Title ambiguity — same title, different IDs, NOT already covered by an
  // ID-collision (that case is handled above and the title would match
  // trivially).
  const leafIdConflictIds = new Set(
    conflicts.filter((c) => c.kind === 'leaf-id').map((c) => (c as LeafConflict).id),
  );
  for (const l of theirs.leaves) {
    if (leafIdConflictIds.has(l.id)) continue;
    const yoursMatch = yoursLeafByTitle.get(l.title.toLowerCase());
    if (yoursMatch && yoursMatch.id !== l.id) {
      conflicts.push({
        kind: 'title',
        yours: yoursMatch,
        theirs: l,
        resolution: 'keep-both-as-is',
      });
    }
  }

  // Fresh sets (no conflict)
  const conflictedLeafIds = new Set(
    conflicts.flatMap((c) =>
      c.kind === 'leaf-id'
        ? [c.id]
        : c.kind === 'title'
          ? [c.theirs.id]
          : [],
    ),
  );
  const conflictedFolderIds = new Set(
    conflicts.flatMap((c) =>
      c.kind === 'folder-name' ? [c.theirsId] : [],
    ),
  );

  const freshLeaves = theirs.leaves.filter((l) => !conflictedLeafIds.has(l.id));
  const freshFolders = theirs.folders.filter(
    (f) => !conflictedFolderIds.has(f.id),
  );
  const freshUsers = theirs.users.filter((u) => !yoursUserIds.has(u.id));

  // Silence unused warnings
  void theirLeavesById;

  return { conflicts, freshLeaves, freshFolders, freshUsers };
}
