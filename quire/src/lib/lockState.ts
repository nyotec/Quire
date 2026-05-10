import { create } from 'zustand';
import type { FolderID, LeafID, ProtectionMode } from '../types';
import { decryptString, encryptString, isEncryptedField } from './crypto';
import type { Leaf, EncryptedField } from '../types';

interface LockSnapshot {
  paletteOpen: boolean;
  settingsOpen: boolean;
  tasksOpen: boolean;
  editingId: LeafID | null;
  focusedId: LeafID | null;
  riverScrollLeft?: number;
  riverScrollTop?: number;
}

interface LockState {
  /** Whether the wiki is currently locked (overlay visible). */
  locked: boolean;
  /** Whether the user has ever unlocked this session (for password mode boot). */
  unlockedSinceBoot: boolean;
  /** Mode the lock screen renders. */
  mode: ProtectionMode;
  /** Detected filename, computed once at boot, refreshed if handle changes. */
  filename: string | null;
  /** Snapshot of UI state taken at lock time, restored on unlock. */
  snapshot: LockSnapshot | null;
  /** Wrong-password attempt counter (per session). */
  failedAttempts: number;
  /** Cooldown end time (epoch ms) or 0. */
  cooldownUntil: number;

  setMode: (m: ProtectionMode) => void;
  setFilename: (f: string | null) => void;
  lock: (snapshot: LockSnapshot | null) => void;
  unlock: () => void;
  consumeSnapshot: () => LockSnapshot | null;
  recordFailure: () => void;
  resetFailures: () => void;
  setCooldownUntil: (epochMs: number) => void;
}

export const useLockState = create<LockState>((set, get) => ({
  locked: false,
  unlockedSinceBoot: false,
  mode: 'curtain',
  filename: null,
  snapshot: null,
  failedAttempts: 0,
  cooldownUntil: 0,

  setMode: (m) => set({ mode: m }),
  setFilename: (f) => set({ filename: f }),

  lock: (snapshot) => {
    if (get().locked) return;
    // Wipe key on lock
    cryptoKeyRef.key = null;
    decryptedBodyCache.clear();
    set({ locked: true, snapshot });
  },

  unlock: () => {
    set({
      locked: false,
      failedAttempts: 0,
      cooldownUntil: 0,
      unlockedSinceBoot: true,
    });
  },

  consumeSnapshot: () => {
    const s = get().snapshot;
    set({ snapshot: null });
    return s;
  },

  recordFailure: () =>
    set((s) => {
      const failed = s.failedAttempts + 1;
      const next: Partial<LockState> = { failedAttempts: failed };
      if (failed >= 3) {
        next.cooldownUntil = Date.now() + 10_000;
      }
      return next;
    }),

  resetFailures: () => set({ failedAttempts: 0, cooldownUntil: 0 }),
  setCooldownUntil: (epochMs) => set({ cooldownUntil: epochMs }),
}));

/**
 * In-memory CryptoKey, held outside the zustand store so it never serializes
 * and so we can null it without triggering re-renders.
 */
export const cryptoKeyRef: { key: CryptoKey | null } = { key: null };

export function setCryptoKey(key: CryptoKey | null) {
  cryptoKeyRef.key = key;
}

export function getCryptoKey(): CryptoKey | null {
  return cryptoKeyRef.key;
}

/**
 * Per-folder unlocked keys, indexed by FolderID. Held outside the zustand
 * store so the CryptoKey objects don't serialize.  Use the public helpers
 * (set/clear/has/getFolderKey) so consumers can subscribe via the bumper.
 */
export const folderKeyRef = new Map<FolderID, CryptoKey>();

/**
 * Bumped whenever folder lock state changes.  Components that depend on
 * folder lock visibility subscribe via `useFolderLockTick` which reads this.
 */
let folderTickListeners = new Set<() => void>();
export function subscribeFolderTick(fn: () => void): () => void {
  folderTickListeners.add(fn);
  return () => {
    folderTickListeners.delete(fn);
  };
}
function bumpFolderTick() {
  for (const fn of folderTickListeners) fn();
}

export function setFolderKey(id: FolderID, key: CryptoKey) {
  folderKeyRef.set(id, key);
  bumpFolderTick();
}
export function clearFolderKey(id: FolderID) {
  folderKeyRef.delete(id);
  bumpFolderTick();
}
export function clearAllFolderKeys() {
  folderKeyRef.clear();
  bumpFolderTick();
}
export function isFolderUnlocked(id: FolderID): boolean {
  return folderKeyRef.has(id);
}
export function getFolderKey(id: FolderID): CryptoKey | undefined {
  return folderKeyRef.get(id);
}

/** Per-leaf decrypted-body cache. Cleared on lock. */
export const decryptedBodyCache: Map<LeafID, string> = new Map();

export function clearDecryptionCache() {
  decryptedBodyCache.clear();
  bumpFolderTick();
}

/** Synchronously read a leaf body if cached, else trigger decrypt and return null. */
export async function getDecryptedBody(leaf: Leaf): Promise<string> {
  if (typeof leaf.body === 'string') return leaf.body;
  if (!isEncryptedField(leaf.body)) return '';
  const cached = decryptedBodyCache.get(leaf.id);
  if (cached !== undefined) return cached;
  const key = getCryptoKey();
  if (!key) return ''; // locked or no key
  const pt = await decryptString(leaf.body as EncryptedField, key);
  decryptedBodyCache.set(leaf.id, pt);
  return pt;
}

export function getCachedBody(leaf: Leaf): string | null {
  if (typeof leaf.body === 'string') return leaf.body;
  return decryptedBodyCache.get(leaf.id) ?? null;
}

/** Synchronous best-effort body access. Returns "" when locked/uncached. */
export function bodyAsString(leaf: Leaf): string {
  if (typeof leaf.body === 'string') return leaf.body;
  return decryptedBodyCache.get(leaf.id) ?? '';
}

export function isEncryptedLeaf(leaf: Leaf): boolean {
  return typeof leaf.body !== 'string';
}

/** Encrypt plaintext with the active key (used when saving edits). */
export async function encryptWithCurrentKey(
  plaintext: string,
): Promise<EncryptedField | null> {
  const key = getCryptoKey();
  if (!key) return null;
  return encryptString(plaintext, key);
}
