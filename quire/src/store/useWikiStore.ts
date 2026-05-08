import { create } from 'zustand';
import type {
  ActiveFilter,
  Leaf,
  LeafID,
  WikiState,
  Settings,
  SaveStatus,
  User,
  UserID,
} from '../types';
import { DEFAULT_SETTINGS, LEGACY_USER_ID } from '../types';
import { extractTags, newLeafId, uuid, debounce } from '../lib/utils';
import { persistence } from './persistence';
import { touchLeaf, findUser } from '../lib/users';

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
  schemaVersion: 2;
  wikiId: string;
  leaves: Leaf[];
  openIds: LeafID[];
  focusedId: LeafID | null;
  settings: Settings;
  lastSaved: string;
  users: User[];
  currentUserId: UserID | null;

  hydrate: (s: WikiState, currentUserId: UserID | null) => void;
  getPersistableState: () => WikiState;

  // leaf ops
  openLeaf: (id: LeafID) => void;
  closeLeaf: (id: LeafID) => void;
  moveLeaf: (id: LeafID, dir: -1 | 1) => void;
  reorderOpen: (fromId: LeafID, toId: LeafID) => void;
  setFocused: (id: LeafID | null) => void;
  setEditing: (id: LeafID | null) => void;
  newLeaf: (title?: string) => Leaf;
  updateLeaf: (next: Leaf) => void;
  deleteLeaf: (id: LeafID) => void;
  togglePin: (id: LeafID) => void;

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
    schemaVersion: 2,
    wikiId: uuid(),
    leaves: [],
    openIds: [],
    focusedId: null,
    settings: DEFAULT_SETTINGS,
    lastSaved: new Date().toISOString(),
    users: [],
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
        schemaVersion: 2,
        wikiId: s.wikiId,
        leaves: s.leaves,
        openIds: s.openIds,
        focusedId: s.focusedId,
        settings: {
          ...DEFAULT_SETTINGS,
          ...s.settings,
          plugins: { ...DEFAULT_SETTINGS.plugins, ...(s.settings?.plugins || {}) },
        },
        lastSaved: s.lastSaved,
        users: s.users || [],
        currentUserId,
      });
    },

    getPersistableState: () => {
      const s = get();
      return {
        schemaVersion: 2,
        wikiId: s.wikiId,
        leaves: s.leaves,
        openIds: s.openIds,
        focusedId: s.focusedId,
        settings: s.settings,
        lastSaved: s.lastSaved,
        users: s.users,
      };
    },

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
      set((s) => ({
        leaves: s.leaves.map((l) =>
          l.id === next.id
            ? touchLeaf(
                {
                  ...next,
                  tags: extractTags(next.body || ''),
                },
                currentUserId,
              )
            : l,
        ),
      }));
    }),

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
