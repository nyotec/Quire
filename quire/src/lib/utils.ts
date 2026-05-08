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
