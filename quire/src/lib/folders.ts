import type { Folder, FolderID, Leaf, LeafID } from '../types';

export interface FolderTreeNode {
  folder: Folder;
  depth: number;
  children: FolderTreeNode[];
}

/**
 * Build a tree from a flat folder array. Stable: same input → same output.
 * Sub-folders within a parent are sorted by `name` (case-insensitive).
 */
export function buildFolderTree(folders: Folder[]): FolderTreeNode[] {
  const byParent = new Map<FolderID | null, Folder[]>();
  for (const f of folders) {
    const k: FolderID | null = f.parentId || null;
    const arr = byParent.get(k) || [];
    arr.push(f);
    byParent.set(k, arr);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }
  function walk(parentId: FolderID | null, depth: number): FolderTreeNode[] {
    const kids = byParent.get(parentId) || [];
    return kids.map((f) => ({
      folder: f,
      depth,
      children: walk(f.id, depth + 1),
    }));
  }
  return walk(null, 0);
}

/** Walk up the parent chain.  Returns folders from `id`'s parent up to root. */
export function ancestorsOf(folders: Folder[], id: FolderID | null): Folder[] {
  if (!id) return [];
  const byId = new Map(folders.map((f) => [f.id, f] as const));
  const out: Folder[] = [];
  let cur = byId.get(id);
  let depth = 0;
  while (cur && cur.parentId && depth < 1024) {
    const p = byId.get(cur.parentId);
    if (!p) break;
    out.push(p);
    cur = p;
    depth++;
  }
  return out;
}

/** Path from root → folder, inclusive.  Used for breadcrumbs. */
export function folderPath(folders: Folder[], id: FolderID | null): Folder[] {
  if (!id) return [];
  const byId = new Map(folders.map((f) => [f.id, f] as const));
  const folder = byId.get(id);
  if (!folder) return [];
  return [...ancestorsOf(folders, id).reverse(), folder];
}

/** Direct + indirect descendants of a folder (does not include the folder itself). */
export function descendantsOf(folders: Folder[], id: FolderID): Folder[] {
  const byParent = new Map<FolderID | null, Folder[]>();
  for (const f of folders) {
    const k: FolderID | null = f.parentId || null;
    const arr = byParent.get(k) || [];
    arr.push(f);
    byParent.set(k, arr);
  }
  const out: Folder[] = [];
  function walk(parentId: FolderID): void {
    const kids = byParent.get(parentId) || [];
    for (const k of kids) {
      out.push(k);
      walk(k.id);
    }
  }
  walk(id);
  return out;
}

/** True if `descendantId` is `id` itself or any descendant of `id`. */
export function isDescendant(folders: Folder[], id: FolderID, descendantId: FolderID): boolean {
  if (id === descendantId) return true;
  return descendantsOf(folders, id).some((f) => f.id === descendantId);
}

/** Closest enclosing folder of a leaf that has its own protection — for crypto resolution. */
export function closestProtectedAncestor(
  folders: Folder[],
  folderId: FolderID | null,
): Folder | null {
  if (!folderId) return null;
  const byId = new Map(folders.map((f) => [f.id, f] as const));
  let cur = byId.get(folderId);
  let depth = 0;
  while (cur && depth < 1024) {
    if (cur.protection) return cur;
    if (!cur.parentId) return null;
    cur = byId.get(cur.parentId);
    depth++;
  }
  return null;
}

/** Resolve unique sibling name by appending (2), (3), ... if a clash exists. */
export function uniqueSiblingName(
  folders: Folder[],
  parentId: FolderID | null,
  desiredName: string,
  excludeId?: FolderID,
): string {
  const siblings = folders.filter(
    (f) => (f.parentId || null) === parentId && f.id !== excludeId,
  );
  const siblingNames = new Set(siblings.map((f) => f.name.toLowerCase()));
  if (!siblingNames.has(desiredName.toLowerCase())) return desiredName;
  let i = 2;
  while (siblingNames.has(`${desiredName.toLowerCase()} (${i})`)) i++;
  return `${desiredName} (${i})`;
}

/** All leaves in a folder; deep=true includes sub-folders recursively. */
export function leavesInFolder(
  leaves: Leaf[],
  folders: Folder[],
  folderId: FolderID | null,
  deep: boolean,
): Leaf[] {
  if (folderId === null) return leaves.filter((l) => !l.folderId);
  if (!deep) return leaves.filter((l) => l.folderId === folderId);
  const ids = new Set<FolderID>([folderId, ...descendantsOf(folders, folderId).map((f) => f.id)]);
  return leaves.filter((l) => l.folderId && ids.has(l.folderId));
}

export function findFolder(folders: Folder[], id: FolderID | null | undefined): Folder | null {
  if (!id) return null;
  return folders.find((f) => f.id === id) || null;
}

/** Set of leaf IDs whose enclosing protected ancestor isn't unlocked. */
export function lockedLeafIds(
  leaves: Leaf[],
  folders: Folder[],
  isFolderUnlocked: (id: FolderID) => boolean,
): Set<LeafID> {
  const out = new Set<LeafID>();
  for (const l of leaves) {
    const enc = closestProtectedAncestor(folders, l.folderId || null);
    if (enc && !isFolderUnlocked(enc.id)) out.add(l.id);
  }
  return out;
}
