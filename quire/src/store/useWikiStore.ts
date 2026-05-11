import { create } from 'zustand';
import type {
  ActiveFilter,
  AutolockConfig,
  Folder,
  FolderID,
  Leaf,
  LeafBody,
  LeafID,
  WikiState,
  Settings,
  SaveStatus,
  ProtectionConfig,
  User,
  UserID,
} from '../types';
import { isDescendant, uniqueSiblingName } from '../lib/folders';
import {
  DEFAULT_AUTOLOCK,
  DEFAULT_PROTECTION,
  DEFAULT_SETTINGS,
  LEGACY_USER_ID,
} from '../types';
import { extractTags, newLeafId, uuid, debounce } from '../lib/utils';
import { persistence } from './persistence';
import { touchLeaf, findUser } from '../lib/users';
import { decryptedBodyCache, encryptWithCurrentKey } from '../lib/lockState';

interface UIState {
  paletteOpen: boolean;
  paletteQuery: string;
  editingId: LeafID | null;
  activeFilter: ActiveFilter;
  draggingId: LeafID | null;
  settingsOpen: boolean;
  toasts: ToastItem[];
  onboardingDismissed: boolean;
  remoteUpdateAvailable: boolean;
  saveStatus: SaveStatus;
  needsIdentity: boolean;
}

export interface ToastItem {
  id: string;
  message: string;
  kind?: 'info' | 'error' | 'success';
  action?: { label: string; run: () => void };
  ttl?: number;
}

export interface WikiStore extends UIState {
  schemaVersion: 4;
  wikiId: string;
  leaves: Leaf[];
  openIds: LeafID[];
  focusedId: LeafID | null;
  settings: Settings;
  lastSaved: string;
  users: User[];
  currentUserId: UserID | null;
  protection: ProtectionConfig;
  autolock: AutolockConfig;

  hydrate: (s: WikiState, currentUserId: UserID | null) => void;
  getPersistableState: () => WikiState;
  setProtection: (p: ProtectionConfig) => void;
  setAutolock: (a: AutolockConfig) => void;
  setLeafBodies: (entries: { id: LeafID; body: LeafBody }[]) => void;
  /** Apply a merged WikiState (from JSON import) as a single transaction. */
  applyMergedState: (merged: WikiState) => void;

  // leaf ops
  openLeaf: (id: LeafID) => void;
  closeLeaf: (id: LeafID) => void;
  moveLeaf: (id: LeafID, dir: -1 | 1) => void;
  reorderOpen: (fromId: LeafID, toId: LeafID) => void;
  setFocused: (id: LeafID | null) => void;
  setEditing: (id: LeafID | null) => void;
  newLeaf: (title?: string) => Leaf;
  updateLeaf: (next: Leaf) => void;
  updateLeafBody: (id: LeafID, plaintext: string) => Promise<void>;
  deleteLeaf: (id: LeafID) => void;
  togglePin: (id: LeafID) => void;

  // folder ops
  folders: Folder[];
  createFolder: (name: string, parentId: FolderID | null) => FolderID;
  renameFolder: (id: FolderID, name: string) => void;
  deleteFolder: (id: FolderID, mode: 'orphan' | 'cascade') => void;
  moveFolder: (id: FolderID, newParentId: FolderID | null) => boolean;
  setFolderColor: (id: FolderID, color: string | null) => void;
  setFolderIcon: (id: FolderID, icon: string | null) => void;
  setFolderProtection: (id: FolderID, protection: Folder['protection']) => void;
  moveLeafToFolder: (leafId: LeafID, folderId: FolderID | null) => void;

  // user ops
  setCurrentUser: (userId: UserID | null) => void;
  addUser: (user: User) => void;
  updateUser: (userId: UserID, patch: Partial<User>) => void;

  // settings
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  togglePlugin: (id: string) => void;

  // ui
  setPaletteOpen: (open: boolean) => void;
  setPaletteQuery: (q: string) => void;
  setActiveFilter: (f: ActiveFilter) => void;
  setDraggingId: (id: LeafID | null) => void;
  setSettingsOpen: (open: boolean) => void;
  pushToast: (t: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
  setOnboardingDismissed: (v: boolean) => void;
  setRemoteUpdateAvailable: (v: boolean) => void;
  setSaveStatus: (s: SaveStatus) => void;
  setNeedsIdentity: (v: boolean) => void;
}

function freshState(): WikiState {
  return {
    schemaVersion: 4,
    wikiId: uuid(),
    leaves: [],
    openIds: [],
    focusedId: null,
    settings: DEFAULT_SETTINGS,
    lastSaved: new Date().toISOString(),
    users: [],
    protection: { ...DEFAULT_PROTECTION },
    autolock: { ...DEFAULT_AUTOLOCK },
    folders: [],
  };
}

const TIER = persistence.detectTier();
const SAVE_DEBOUNCE_MS = TIER === 'A' ? 500 : 400;

let debouncedSave: ((state: WikiState) => void) | null = null;

function scheduleSave() {
  if (!debouncedSave) {
    debouncedSave = debounce(async (state: WikiState) => {
      await persistence.save(state);
    }, SAVE_DEBOUNCE_MS);
  }
  const state = useWikiStore.getState().getPersistableState();
  debouncedSave(state);
}

export const useWikiStore = create<WikiStore>((set, get) => {
  const initial = freshState();

  const persistAfter = <T extends (...a: any[]) => any>(fn: T): T => {
    return ((...args: any[]) => {
      const r = fn(...args);
      if (persistence.detectTier() === 'B') {
        const s = get();
        persistence.setPendingChanges(s.saveStatus.pendingChanges + 1);
      }
      scheduleSave();
      return r;
    }) as T;
  };

  return {
    ...initial,
    currentUserId: null,
    paletteOpen: false,
    paletteQuery: '',
    editingId: null,
    activeFilter: null,
    draggingId: null,
    settingsOpen: false,
    toasts: [],
    onboardingDismissed: false,
    remoteUpdateAvailable: false,
    needsIdentity: false,
    saveStatus: persistence.getStatus(),

    hydrate: (s, currentUserId) => {
      set({
        schemaVersion: 4,
        wikiId: s.wikiId,
        leaves: s.leaves,
        openIds: s.openIds,
        focusedId: s.focusedId,
        settings: {
          ...DEFAULT_SETTINGS,
          ...s.settings,
          plugins: { ...DEFAULT_SETTINGS.plugins, ...(s.settings?.plugins || {}) },
          tasks: { ...DEFAULT_SETTINGS.tasks, ...(s.settings?.tasks || {}) },
        },
        lastSaved: s.lastSaved,
        users: s.users || [],
        protection: { ...DEFAULT_PROTECTION, ...(s.protection || {}) },
        autolock: { ...DEFAULT_AUTOLOCK, ...(s.autolock || {}) },
        folders: s.folders || [],
        currentUserId,
      });
    },

    getPersistableState: () => {
      const s = get();
      return {
        schemaVersion: 4,
        wikiId: s.wikiId,
        leaves: s.leaves,
        openIds: s.openIds,
        focusedId: s.focusedId,
        settings: s.settings,
        lastSaved: s.lastSaved,
        users: s.users,
        protection: s.protection,
        autolock: s.autolock,
        folders: s.folders,
      };
    },

    setProtection: persistAfter((p: ProtectionConfig) => {
      set({ protection: p });
    }),
    setAutolock: persistAfter((a: AutolockConfig) => {
      set({ autolock: a });
    }),
    setLeafBodies: persistAfter((entries: { id: LeafID; body: LeafBody }[]) => {
      const map = new Map(entries.map((e) => [e.id, e.body] as const));
      set((s) => ({
        leaves: s.leaves.map((l) => (map.has(l.id) ? { ...l, body: map.get(l.id)! } : l)),
      }));
    }),

    applyMergedState: persistAfter((merged: WikiState) => {
      set({
        leaves: merged.leaves,
        folders: merged.folders,
        users: merged.users,
        lastSaved: merged.lastSaved,
      });
    }),

    openLeaf: (id) => {
      set((s) => ({
        openIds: s.openIds.includes(id) ? s.openIds : [...s.openIds, id],
        focusedId: id,
      }));
      scheduleSave();
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-leaf-id="${id}"]`);
        if (el)
          (el as HTMLElement).scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
          });
      });
    },

    closeLeaf: (id) => {
      set((s) => {
        const i = s.openIds.indexOf(id);
        if (i < 0) return s;
        const next = s.openIds.filter((x) => x !== id);
        const focused =
          s.focusedId === id ? next[Math.max(0, i - 1)] || next[0] || null : s.focusedId;
        return {
          openIds: next,
          focusedId: focused,
          editingId: s.editingId === id ? null : s.editingId,
        };
      });
      scheduleSave();
    },

    moveLeaf: (id, dir) => {
      set((s) => {
        const i = s.openIds.indexOf(id);
        if (i < 0) return s;
        const j = Math.max(0, Math.min(s.openIds.length - 1, i + dir));
        if (i === j) return s;
        const next = [...s.openIds];
        [next[i], next[j]] = [next[j], next[i]];
        return { openIds: next };
      });
      scheduleSave();
    },

    reorderOpen: (fromId, toId) => {
      set((s) => {
        const a = s.openIds.indexOf(fromId);
        const b = s.openIds.indexOf(toId);
        if (a < 0 || b < 0 || a === b) return s;
        const next = [...s.openIds];
        next.splice(a, 1);
        next.splice(b, 0, fromId);
        return { openIds: next };
      });
      scheduleSave();
    },

    setFocused: (id) => set({ focusedId: id }),
    setEditing: (id) => set({ editingId: id }),

    newLeaf: (title) => {
      const t = (title || 'Untitled').trim();
      const id = newLeafId(t);
      const now = new Date().toISOString();
      const author = get().currentUserId || LEGACY_USER_ID;
      const leaf: Leaf = {
        id,
        title: t,
        body: '',
        tags: [],
        created: now,
        edited: now,
        authorId: author,
        lastEditedBy: author,
        contributors: [author],
      };
      set((s) => ({
        leaves: [leaf, ...s.leaves],
        openIds: [id, ...s.openIds],
        focusedId: id,
        editingId: id,
        paletteOpen: false,
      }));
      if (persistence.detectTier() === 'B') {
        const s = get();
        persistence.setPendingChanges(s.saveStatus.pendingChanges + 1);
      }
      scheduleSave();
      return leaf;
    },

    updateLeaf: persistAfter((next: Leaf) => {
      const currentUserId = get().currentUserId || LEGACY_USER_ID;
      // updateLeaf is for non-body changes (title, pin, isJournal, etc.).
      // It does not re-extract tags — tags come from body and only change via
      // updateLeafBody. We preserve the existing body shape (string or
      // EncryptedField) untouched.
      set((s) => ({
        leaves: s.leaves.map((l) => {
          if (l.id !== next.id) return l;
          const merged = { ...next, body: l.body, tags: l.tags };
          return touchLeaf(merged, currentUserId);
        }),
      }));
    }),

    updateLeafBody: async (id: LeafID, plaintext: string) => {
      const s = get();
      const leaf = s.leaves.find((l) => l.id === id);
      if (!leaf) return;
      const currentUserId = s.currentUserId || LEGACY_USER_ID;
      const tags = extractTags(plaintext);
      decryptedBodyCache.set(id, plaintext);
      let body: LeafBody = plaintext;
      if (s.protection.mode === 'password') {
        const enc = await encryptWithCurrentKey(plaintext);
        if (!enc) {
          // No key available (locked) — leave as-is to avoid corruption.
          return;
        }
        body = enc;
      }
      set((cur) => ({
        leaves: cur.leaves.map((l) =>
          l.id === id ? touchLeaf({ ...l, body, tags }, currentUserId) : l,
        ),
      }));
      if (persistence.detectTier() === 'B') {
        persistence.setPendingChanges(get().saveStatus.pendingChanges + 1);
      }
      scheduleSave();
    },

    deleteLeaf: persistAfter((id: LeafID) => {
      set((s) => ({
        leaves: s.leaves.filter((l) => l.id !== id),
        openIds: s.openIds.filter((x) => x !== id),
        focusedId: s.focusedId === id ? null : s.focusedId,
        editingId: s.editingId === id ? null : s.editingId,
      }));
    }),

    togglePin: persistAfter((id: LeafID) => {
      const currentUserId = get().currentUserId || LEGACY_USER_ID;
      set((s) => ({
        leaves: s.leaves.map((l) =>
          l.id === id ? touchLeaf({ ...l, pinned: !l.pinned }, currentUserId) : l,
        ),
      }));
    }),

    // ─── folder CRUD ─────────────────────────────────────────────────────
    createFolder: (name: string, parentId: FolderID | null): FolderID => {
      const cur = get();
      const id = uuid();
      const safeName = uniqueSiblingName(cur.folders, parentId, (name || 'Folder').trim());
      const folder: Folder = {
        id,
        name: safeName,
        parentId,
        created: new Date().toISOString(),
      };
      set((s) => ({ folders: [...s.folders, folder] }));
      if (persistence.detectTier() === 'B') {
        persistence.setPendingChanges(get().saveStatus.pendingChanges + 1);
      }
      scheduleSave();
      return id;
    },

    renameFolder: persistAfter((id: FolderID, name: string) => {
      set((s) => ({
        folders: s.folders.map((f) =>
          f.id === id
            ? { ...f, name: uniqueSiblingName(s.folders, f.parentId, name.trim() || f.name, id) }
            : f,
        ),
      }));
    }),

    deleteFolder: persistAfter((id: FolderID, mode: 'orphan' | 'cascade') => {
      set((s) => {
        if (mode === 'orphan') {
          // Reparent direct children to root, unfile direct leaves
          return {
            folders: s.folders
              .filter((f) => f.id !== id)
              .map((f) => (f.parentId === id ? { ...f, parentId: null } : f)),
            leaves: s.leaves.map((l) => (l.folderId === id ? { ...l, folderId: null } : l)),
          };
        }
        // cascade: delete folder + descendants + their leaves
        const toDelete = new Set<FolderID>([id]);
        let added = true;
        while (added) {
          added = false;
          for (const f of s.folders) {
            if (f.parentId && toDelete.has(f.parentId) && !toDelete.has(f.id)) {
              toDelete.add(f.id);
              added = true;
            }
          }
        }
        return {
          folders: s.folders.filter((f) => !toDelete.has(f.id)),
          leaves: s.leaves.filter((l) => !l.folderId || !toDelete.has(l.folderId)),
        };
      });
    }),

    moveFolder: (id: FolderID, newParentId: FolderID | null): boolean => {
      const cur = get();
      if (id === newParentId) return false;
      if (newParentId && isDescendant(cur.folders, id, newParentId)) return false;
      set((s) => ({
        folders: s.folders.map((f) => {
          if (f.id !== id) return f;
          const safeName = uniqueSiblingName(s.folders, newParentId, f.name, id);
          return { ...f, parentId: newParentId, name: safeName };
        }),
      }));
      if (persistence.detectTier() === 'B') {
        persistence.setPendingChanges(get().saveStatus.pendingChanges + 1);
      }
      scheduleSave();
      return true;
    },

    setFolderColor: persistAfter((id: FolderID, color: string | null) => {
      set((s) => ({
        folders: s.folders.map((f) =>
          f.id === id ? { ...f, color: color || undefined } : f,
        ),
      }));
    }),

    setFolderIcon: persistAfter((id: FolderID, icon: string | null) => {
      set((s) => ({
        folders: s.folders.map((f) =>
          f.id === id ? { ...f, icon: icon || undefined } : f,
        ),
      }));
    }),

    setFolderProtection: persistAfter(
      (id: FolderID, protection: Folder['protection']) => {
        set((s) => ({
          folders: s.folders.map((f) =>
            f.id === id
              ? protection
                ? { ...f, protection }
                : (() => {
                    const { protection: _drop, ...rest } = f;
                    return rest as Folder;
                  })()
              : f,
          ),
        }));
      },
    ),

    moveLeafToFolder: persistAfter((leafId: LeafID, folderId: FolderID | null) => {
      set((s) => ({
        leaves: s.leaves.map((l) => (l.id === leafId ? { ...l, folderId } : l)),
      }));
    }),

    setCurrentUser: (userId) => set({ currentUserId: userId }),

    addUser: persistAfter((user: User) => {
      set((s) =>
        s.users.find((u) => u.id === user.id) ? s : { users: [...s.users, user] },
      );
    }),

    updateUser: persistAfter((userId: UserID, patch: Partial<User>) => {
      set((s) => ({
        users: s.users.map((u) => (u.id === userId ? { ...u, ...patch } : u)),
      }));
      try {
        persistence.broadcastUserUpdate(userId);
      } catch {
        // ignore
      }
    }),

    setSetting: persistAfter(<K extends keyof Settings>(key: K, value: Settings[K]) => {
      set((s) => ({ settings: { ...s.settings, [key]: value } }));
    }),

    togglePlugin: persistAfter((id: string) => {
      set((s) => ({
        settings: {
          ...s.settings,
          plugins: { ...s.settings.plugins, [id]: !s.settings.plugins[id] },
        },
      }));
    }),

    setPaletteOpen: (open) => set({ paletteOpen: open }),
    setPaletteQuery: (q) => set({ paletteQuery: q }),
    setActiveFilter: (f) => set({ activeFilter: f }),
    setDraggingId: (id) => set({ draggingId: id }),
    setSettingsOpen: (open) => set({ settingsOpen: open }),
    pushToast: (t) =>
      set((s) => ({
        toasts: [...s.toasts, { id: Math.random().toString(36).slice(2, 9), ...t }],
      })),
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
    setOnboardingDismissed: (v) => set({ onboardingDismissed: v }),
    setRemoteUpdateAvailable: (v) => set({ remoteUpdateAvailable: v }),
    setSaveStatus: (s) => set({ saveStatus: s }),
    setNeedsIdentity: (v) => set({ needsIdentity: v }),
  };
});

// ─── selectors ──────────────────────────────────────────────────────────────
export function useCurrentUser(): User | null {
  return useWikiStore((s) =>
    s.currentUserId ? findUser(s.users, s.currentUserId) : null,
  );
}

export function useUserById(id: UserID | null | undefined): User | null {
  return useWikiStore((s) => findUser(s.users, id || null));
}
