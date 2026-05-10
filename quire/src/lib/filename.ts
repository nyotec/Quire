/** Detect the wiki's filename for display on the lock screen. */

export function detectFilenameFromLocation(): string | null {
  if (typeof window === 'undefined' || !window.location) return null;
  let path = window.location.pathname || '';
  // Strip query/hash if present
  const q = path.indexOf('?');
  if (q >= 0) path = path.slice(0, q);
  const h = path.indexOf('#');
  if (h >= 0) path = path.slice(0, h);
  const seg = path.split('/').pop() || '';
  if (!seg) return null;
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

export function detectFilenameFromHandle(handle: any): string | null {
  if (!handle || typeof handle.name !== 'string') return null;
  return handle.name || null;
}

/** Truncate a long filename in the middle: foo…bar.html. Leaves extension visible. */
export function truncateFilename(name: string, max = 40): string {
  if (!name || name.length <= max) return name;
  // Try to keep the trailing extension chunk (~14 chars)
  const tailLen = Math.min(14, Math.floor(max / 2));
  const headLen = Math.max(1, max - tailLen - 1);
  return name.slice(0, headLen) + '…' + name.slice(name.length - tailLen);
}
