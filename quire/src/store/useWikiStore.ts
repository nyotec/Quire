import { create } from 'zustand';
import type { Leaf, LeafID, WikiState, Settings, SaveStatus } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { extractTags, newLeafId, uuid, debounce } from '../lib/utils';
import { persistence } from './persistence';

interface UIState {
  paletteOpen: boolean;
  paletteQuery: string;
  editingId: LeafID | null;
  activeTag: string | null;
  draggingId: LeafID | null;
  settingsOpen: boolean;
  toasts: ToastItem[];
  onboardingDismissed: boolean;
  remoteUpdateAvailable: boolean;
  saveStatus: SaveStatus;
}

export interface ToastItem {
  id: string;
  message: string;
  kind?: 'info' | 'error' | 'success';
  action?: { label: string; run: () => void };
  ttl?: number;
}

export interface WikiStore extends UIState {
  // canonical state
  schemaVersion: 1;
  wikiId: string;
  leaves: Leaf[];
  openIds: LeafID[];
  focusedId: LeafID | null;
  settings: Settings;
  lastSaved: string;

  // hydration
  hydrate: (s: WikiState) => void;
  getPersistableState: () => WikiState;

  // ops
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

  // settings
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  togglePlugin: (id: string) => void;

  // ui
  setPaletteOpen: (open: boolean) => void;
  setPaletteQuery: (q: string) => void;
  setActiveTag: (t: string | null) => void;
  setDraggingId: (id: LeafID | null) => void;
  setSettingsOpen: (open: boolean) => void;
  pushToast: (t: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
  setOnboardingDismissed: (v: boolean) => void;
  setRemoteUpdateAvailable: (v: boolean) => void;
  setSaveStatus: (s: SaveStatus) => void;
}

function freshState(): WikiState {
  return {
    schemaVersion: 1,
    wikiId: uuid(),
    leaves: [],
    openIds: [],
    focusedId: null,
    settings: DEFAULT_SETTINGS,
    lastSaved: new Date().toISOString(),
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

  // After every mutation that should persist, we call scheduleSave.
  const persistAfter = <T extends (...a: any[]) => any>(fn: T): T => {
    return ((...args: any[]) => {
      const r = fn(...args);
      // bump pending changes for tier B
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
    paletteOpen: false,
    paletteQuery: '',
    editingId: null,
    activeTag: null,
    draggingId: null,
    settingsOpen: false,
    toasts: [],
    onboardingDismissed: false,
    remoteUpdateAvailable: false,
    saveStatus: persistence.getStatus(),

    hydrate: (s) => {
      set({
        schemaVersion: s.schemaVersion,
        wikiId: s.wikiId,
        leaves: s.leaves,
        openIds: s.openIds,
        focusedId: s.focusedId,
        settings: { ...DEFAULT_SETTINGS, ...s.settings, plugins: { ...DEFAULT_SETTINGS.plugins, ...(s.settings?.plugins || {}) } },
        lastSaved: s.lastSaved,
      });
    },

    getPersistableState: () => {
      const s = get();
      return {
        schemaVersion: 1,
        wikiId: s.wikiId,
        leaves: s.leaves,
        openIds: s.openIds,
        focusedId: s.focusedId,
        settings: s.settings,
        lastSaved: s.lastSaved,
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
        if (el) (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
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
      const leaf: Leaf = {
        id,
        title: t,
        body: '',
        tags: [],
        created: now,
        edited: now,
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
      set((s) => ({
        leaves: s.leaves.map((l) =>
          l.id === next.id
            ? {
                ...next,
                edited: new Date().toISOString(),
                tags: extractTags(next.body || ''),
              }
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
      set((s) => ({
        leaves: s.leaves.map((l) => (l.id === id ? { ...l, pinned: !l.pinned } : l)),
      }));
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
    setActiveTag: (t) => set({ activeTag: t }),
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
  };
});
