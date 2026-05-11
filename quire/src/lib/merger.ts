import type { Folder, FolderID, Leaf, LeafID, WikiState } from '../types';
import type {
  Conflict,
  ConflictReport,
  FolderConflict,
  LeafConflict,
  TitleConflict,
} from './conflictDetector';

export interface MergeOutcome {
  state: WikiState;
  stats: {
    leavesAdded: number;
    leavesReplaced: number;
    leavesRenamed: number;
    foldersAdded: number;
    foldersMerged: number;
    foldersRenamed: number;
    usersAdded: number;
  };
}

/**
 * Apply the conflict report's resolutions to produce a merged WikiState.
 * Pure function — does not mutate inputs.
 */
export function mergeImport(
  yours: WikiState,
  theirs: WikiState,
  report: ConflictReport,
): MergeOutcome {
  const stats = {
    leavesAdded: 0,
    leavesReplaced: 0,
    leavesRenamed: 0,
    foldersAdded: 0,
    foldersMerged: 0,
    foldersRenamed: 0,
    usersAdded: 0,
  };

  // Start with the existing wiki's content.
  let leaves: Leaf[] = [...yours.leaves];
  let folders: Folder[] = [...yours.folders];
  let users = [...yours.users];

  const yoursLeafById = new Map(leaves.map((l) => [l.id, l] as const));
  const yoursFolderById = new Map(folders.map((f) => [f.id, f] as const));

  // ─── 1. Resolve folder conflicts first ─────────────────────────────────
  // Build a map: theirsFolderId → effective destination folderId in the
  // merged wiki. For 'merge', maps to your existing folder. For 'rename-theirs',
  // maps to a new (renamed) folder id (we use theirs' id, since theirs is fresh
  // outside the collision).
  const folderIdRemap = new Map<FolderID, FolderID>();
  const folderConflicts = report.conflicts.filter(
    (c) => c.kind === 'folder-name',
  ) as FolderConflict[];
  for (const fc of folderConflicts) {
    if (fc.resolution === 'merge') {
      folderIdRemap.set(fc.theirsId, fc.yoursId);
      stats.foldersMerged++;
    } else {
      // rename-theirs: append (imported) to name
      const orig = theirs.folders.find((f) => f.id === fc.theirsId);
      if (orig) {
        const renamed: Folder = {
          ...orig,
          name: `${orig.name} (imported)`,
        };
        folders.push(renamed);
        yoursFolderById.set(renamed.id, renamed);
        stats.foldersRenamed++;
      }
    }
  }
  // Fresh folders (no name collision) — add as-is.
  for (const f of report.freshFolders) {
    folders.push(f);
    yoursFolderById.set(f.id, f);
    stats.foldersAdded++;
  }
  // Repair freshFolders' parentIds: if a folder's parent was merged (and so
  // its id was remapped), update parentId.
  folders = folders.map((f) => {
    if (f.parentId && folderIdRemap.has(f.parentId)) {
      return { ...f, parentId: folderIdRemap.get(f.parentId)! };
    }
    return f;
  });

  // ─── 2. Resolve leaf ID conflicts ──────────────────────────────────────
  const leafConflicts = report.conflicts.filter(
    (c) => c.kind === 'leaf-id',
  ) as LeafConflict[];
  const leafIdRemap = new Map<LeafID, LeafID>(); // theirs old-id → new-id for keep-both

  for (const lc of leafConflicts) {
    if (lc.resolution === 'keep-yours') {
      // imported leaf is dropped — nothing to do
    } else if (lc.resolution === 'keep-theirs') {
      // your leaf is replaced by theirs
      const idx = leaves.findIndex((l) => l.id === lc.id);
      if (idx >= 0) {
        leaves[idx] = remapLeafFolder(lc.theirs, folderIdRemap);
        stats.leavesReplaced++;
      }
    } else {
      // keep-both — imported leaf gets a new id
      const newId = `${lc.id}-imported-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      leafIdRemap.set(lc.id, newId);
      const cloned: Leaf = remapLeafFolder(
        { ...lc.theirs, id: newId },
        folderIdRemap,
      );
      leaves.push(cloned);
      stats.leavesRenamed++;
    }
  }

  // ─── 3. Resolve title conflicts ───────────────────────────────────────
  const titleConflicts = report.conflicts.filter(
    (c) => c.kind === 'title',
  ) as TitleConflict[];
  for (const tc of titleConflicts) {
    if (tc.resolution === 'rename-theirs') {
      const cloned: Leaf = remapLeafFolder(
        { ...tc.theirs, title: `${tc.theirs.title} (imported)` },
        folderIdRemap,
      );
      leaves.push(cloned);
      stats.leavesAdded++;
    } else if (tc.resolution === 'rename-yours') {
      const idx = leaves.findIndex((l) => l.id === tc.yours.id);
      if (idx >= 0) {
        leaves[idx] = { ...leaves[idx], title: `${leaves[idx].title} (yours)` };
      }
      // Add theirs as-is (with folder remap)
      leaves.push(remapLeafFolder(tc.theirs, folderIdRemap));
      stats.leavesAdded++;
    } else {
      // keep-both-as-is
      leaves.push(remapLeafFolder(tc.theirs, folderIdRemap));
      stats.leavesAdded++;
    }
  }

  // ─── 4. Fresh leaves (no conflict) ────────────────────────────────────
  for (const l of report.freshLeaves) {
    leaves.push(remapLeafFolder(l, folderIdRemap));
    stats.leavesAdded++;
  }

  // ─── 5. Fresh users ───────────────────────────────────────────────────
  for (const u of report.freshUsers) {
    users.push(u);
    stats.usersAdded++;
  }

  // ─── 6. Remap wikilinks inside imported leaves whose IDs changed ─────
  // (We only need to update body content because wikilinks reference titles,
  // not IDs. So nothing to do at the data level. Title-rename effects are
  // already applied above.)
  void leafIdRemap;

  const merged: WikiState = {
    ...yours,
    leaves,
    folders,
    users,
    lastSaved: new Date().toISOString(),
  };
  return { state: merged, stats };
}

function remapLeafFolder(leaf: Leaf, remap: Map<FolderID, FolderID>): Leaf {
  if (!leaf.folderId) return leaf;
  if (!remap.has(leaf.folderId)) return leaf;
  return { ...leaf, folderId: remap.get(leaf.folderId)! };
}

/** Bulk-apply the same resolution to every conflict of compatible type. */
export function bulkSetResolution(
  report: ConflictReport,
  resolution: Conflict['resolution'],
): ConflictReport {
  const conflicts = report.conflicts.map((c) => {
    if (c.kind === 'leaf-id' && (resolution === 'keep-yours' || resolution === 'keep-theirs' || resolution === 'keep-both')) {
      return { ...c, resolution } as LeafConflict;
    }
    if (c.kind === 'folder-name' && (resolution === 'merge' || resolution === 'rename-theirs')) {
      return { ...c, resolution } as FolderConflict;
    }
    if (c.kind === 'title' && (resolution === 'rename-theirs' || resolution === 'rename-yours' || resolution === 'keep-both-as-is')) {
      return { ...c, resolution } as TitleConflict;
    }
    return c;
  });
  return { ...report, conflicts };
}
