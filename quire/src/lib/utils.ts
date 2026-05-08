export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function formatRel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  const min = Math.floor(ms / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function extractWikilinks(body: string): string[] {
  const set = new Set<string>();
  const rx = /\[\[([^\]]+?)\]\]/g;
  let m;
  while ((m = rx.exec(body)) !== null) set.add(m[1].trim());
  return [...set];
}

export function extractTags(body: string): string[] {
  const set = new Set<string>();
  const rx = /(^|\s)#([a-zA-Z][\w/-]*)/g;
  let m;
  while ((m = rx.exec(body)) !== null) set.add(m[2]);
  return [...set];
}

export function newLeafId(title: string): string {
  return slug(title || 'untitled') + '-' + Math.random().toString(36).slice(2, 6);
}

export function debounce<F extends (...args: any[]) => any>(fn: F, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<F>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => { if (timer) clearTimeout(timer); timer = null; };
  debounced.flush = (...args: Parameters<F>) => {
    if (timer) clearTimeout(timer);
    timer = null;
    return fn(...args);
  };
  return debounced as F & { cancel: () => void; flush: (...args: Parameters<F>) => any };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// ─── date helpers (for tasks v1.2) ────────────────────────────────────────
export function todayISODate(): string {
  // YYYY-MM-DD in local time, not UTC
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export type DueState = 'overdue' | 'today' | 'upcoming' | 'done';

export function dueStatus(dueDate: string, done: boolean): DueState {
  if (done) return 'done';
  const today = todayISODate();
  const cmp = compareDates(dueDate, today);
  if (cmp < 0) return 'overdue';
  if (cmp === 0) return 'today';
  return 'upcoming';
}

export function isValidISODate(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = new Date(d + 'T00:00').getTime();
  return !Number.isNaN(t);
}

export function daysBetween(a: string, b: string): number {
  const ms = new Date(b + 'T00:00').getTime() - new Date(a + 'T00:00').getTime();
  return Math.round(ms / 86400000);
}

export type DateFormat = 'relative' | 'absolute' | 'both';

export function formatDue(dueDate: string, format: DateFormat = 'relative'): string {
  if (!isValidISODate(dueDate)) return dueDate;
  const today = todayISODate();
  const diff = daysBetween(today, dueDate);
  const absolute = new Date(dueDate + 'T00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  let relative: string;
  if (diff === 0) relative = 'today';
  else if (diff === 1) relative = 'tomorrow';
  else if (diff === -1) relative = 'yesterday';
  else if (diff > 0 && diff < 7) relative = `in ${diff}d`;
  else if (diff < 0 && diff > -7) relative = `${-diff}d ago`;
  else relative = absolute;
  if (format === 'absolute') return absolute;
  if (format === 'both' && relative !== absolute) return `${relative} (${absolute})`;
  return relative;
}
