import type {
  EncryptedField,
  Folder,
  FolderID,
  FolderProtection,
  Leaf,
} from '../types';
import { FOLDER_VERIFIER_PLAINTEXT } from '../types';
import {
  bytesToBase64,
  decryptString,
  deriveKey,
  encryptString,
  isEncryptedField,
  randomSaltB64,
  calibrateIterations,
} from './crypto';
import {
  clearFolderKey,
  decryptedBodyCache,
  getFolderKey,
  isFolderUnlocked,
  setFolderKey,
} from './lockState';
import { closestProtectedAncestor } from './folders';

export async function makeFolderProtection(
  password: string,
  hideName: boolean,
  hideContents: boolean,
): Promise<{ key: CryptoKey; protection: FolderProtection }> {
  const iterations = await calibrateIterations(500);
  const salt = randomSaltB64();
  const key = await deriveKey(password, salt, iterations);
  const verifier = await encryptString(FOLDER_VERIFIER_PLAINTEXT, key);
  return {
    key,
    protection: {
      salt,
      iterations,
      hash: 'SHA-256',
      verifier,
      hideName,
      hideContents,
    },
  };
}

/** Verify folder password.  Returns the derived key on success, null otherwise. */
export async function verifyFolderPassword(
  folder: Folder,
  password: string,
): Promise<CryptoKey | null> {
  if (!folder.protection) throw new Error('Folder is not protected');
  try {
    const key = await deriveKey(
      password,
      folder.protection.salt,
      folder.protection.iterations,
    );
    const value = await decryptString(folder.protection.verifier, key);
    if (value === FOLDER_VERIFIER_PLAINTEXT) return key;
    return null;
  } catch {
    return null;
  }
}

/** Resolve the key that *should* protect this leaf (closest enclosing). null = plaintext. */
export function resolveProtectingFolder(
  folders: Folder[],
  folderId: FolderID | null,
): Folder | null {
  return closestProtectedAncestor(folders, folderId || null);
}

/** True if a leaf body is currently readable (plaintext, or its enclosing folder is unlocked). */
export function isLeafAccessible(folders: Folder[], leaf: Leaf): boolean {
  if (typeof leaf.body === 'string') return true;
  const enc = closestProtectedAncestor(folders, leaf.folderId || null);
  if (!enc) return true; // body is encrypted but no protected ancestor — odd, but treat as accessible
  return isFolderUnlocked(enc.id);
}

/** Decrypt one leaf body using the appropriate folder key.  Caches result. */
export async function decryptLeafBody(
  folders: Folder[],
  leaf: Leaf,
): Promise<string | null> {
  if (typeof leaf.body === 'string') return leaf.body;
  if (!isEncryptedField(leaf.body)) return null;
  const cached = decryptedBodyCache.get(leaf.id);
  if (cached !== undefined) return cached;
  const enc = closestProtectedAncestor(folders, leaf.folderId || null);
  if (!enc) return null;
  const key = getFolderKey(enc.id);
  if (!key) return null;
  try {
    const pt = await decryptString(leaf.body as EncryptedField, key);
    decryptedBodyCache.set(leaf.id, pt);
    return pt;
  } catch (err) {
    console.warn('decrypt leaf failed', leaf.id, err);
    return null;
  }
}

/**
 * Encrypt a plaintext body using the protecting folder's key, if one exists.
 * Returns the EncryptedField, or the plaintext unchanged if no protection applies.
 */
export async function encryptForFolder(
  folders: Folder[],
  folderId: FolderID | null,
  plaintext: string,
): Promise<string | EncryptedField> {
  const enc = closestProtectedAncestor(folders, folderId);
  if (!enc) return plaintext;
  const key = getFolderKey(enc.id);
  if (!key) {
    // Locked: should not be reached in normal flows; caller must unlock first.
    throw new Error('Cannot encrypt — protecting folder is locked');
  }
  return encryptString(plaintext, key);
}

/** Wipe a folder's key + the body cache for its leaves. */
export function lockFolder(folder: Folder, leaves: Leaf[]) {
  clearFolderKey(folder.id);
  for (const l of leaves) {
    if (l.folderId === folder.id) decryptedBodyCache.delete(l.id);
  }
}

/** Cache a freshly-derived key for a folder. */
export function unlockFolderKey(folder: Folder, key: CryptoKey) {
  setFolderKey(folder.id, key);
}

/** Helpers for re-export. */
export { bytesToBase64 };
