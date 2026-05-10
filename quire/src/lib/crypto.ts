import type { EncryptedField, ProtectionConfig } from '../types';
import { VERIFIER_PLAINTEXT } from '../types';

const enc = new TextEncoder();
const dec = new TextDecoder();

export function bytesToBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

export function base64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}

export function randomSaltB64(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function deriveKey(
  password: string,
  saltB64: string,
  iterations: number,
): Promise<CryptoKey> {
  const salt = base64ToBytes(saltB64);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptString(
  plaintext: string,
  key: CryptoKey,
): Promise<EncryptedField> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    enc.encode(plaintext) as BufferSource,
  );
  return { v: 1, iv: bytesToBase64(iv), ct: bytesToBase64(new Uint8Array(ct)) };
}

export async function decryptString(field: EncryptedField, key: CryptoKey): Promise<string> {
  const iv = base64ToBytes(field.iv);
  const ct = base64ToBytes(field.ct);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ct as BufferSource,
  );
  return dec.decode(pt);
}

/** Derive + verifier-decrypt; returns the key on success, null on wrong password. */
export async function verifyPassword(
  password: string,
  config: ProtectionConfig,
): Promise<CryptoKey | null> {
  if (
    config.mode !== 'password' ||
    !config.salt ||
    !config.iterations ||
    !config.verifier
  ) {
    throw new Error('Wiki is not password-protected');
  }
  const key = await deriveKey(password, config.salt, config.iterations);
  try {
    const value = await decryptString(config.verifier, key);
    return value === VERIFIER_PLAINTEXT ? key : null;
  } catch {
    return null;
  }
}

/** Build a fresh verifier (encrypts the known plaintext with the given key). */
export async function makeVerifier(key: CryptoKey): Promise<EncryptedField> {
  return encryptString(VERIFIER_PLAINTEXT, key);
}

/**
 * Calibrate PBKDF2 iterations so unlock takes ~targetMs on this device.
 * Result is per-wiki and stored in protection.iterations.
 */
export async function calibrateIterations(targetMs = 500): Promise<number> {
  const probe = 50_000;
  const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
  const start = performance.now();
  await deriveKey('calibration-probe', salt, probe);
  const elapsed = performance.now() - start;
  if (elapsed <= 0) return 250_000;
  const calibrated = Math.round((targetMs / elapsed) * probe);
  // clamp so a fast machine doesn't push beyond reasonable bounds and a slow
  // machine doesn't end up with too few iterations
  return Math.max(100_000, Math.min(calibrated, 1_000_000));
}

/** Type guard for EncryptedField. */
export function isEncryptedField(x: unknown): x is EncryptedField {
  return (
    !!x &&
    typeof x === 'object' &&
    (x as any).v === 1 &&
    typeof (x as any).iv === 'string' &&
    typeof (x as any).ct === 'string'
  );
}
