import { openDB, IDBPDatabase } from 'idb';
import type { WikiState, SaveStatus, Tier, UserID } from '../types';
import { migrateToV2 } from '../lib/users';

const DB_NAME = 'quire';
const DB_VERSION = 2;
const STORE_DRAFTS = 'drafts';
const STORE_HANDLES = 'handles';
const STORE_META = 'meta';
const STORE_IDENTITY = 'identity';

interface QuireDB {
  drafts: { key: string; value: { state: WikiState; lastSaved: string } };
  handles: { key: string; value: any };
  meta: { key: string; value: any };
}

function getDB(): Promise<IDBPDatabase<any>> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE_DRAFTS)) db.createObjectStore(STORE_DRAFTS);
        if (!db.objectStoreNames.contains(STORE_HANDLES)) db.createObjectStore(STORE_HANDLES);
        if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(STORE_IDENTITY)) db.createObjectStore(STORE_IDENTITY);
      }
    },
  });
}

function serializeWikiState(state: WikiState): string {
  // Strip transient UI fields. We only persist data + settings + open/focused IDs.
  const persisted: WikiState = {
    schemaVersion: state.schemaVersion,
    wikiId: state.wikiId,
    leaves: state.leaves,
    openIds: state.openIds,
    focusedId: state.focusedId,
    settings: state.settings,
    lastSaved: state.lastSaved,
    users: state.users,
  };
  // Escape `</` to `<\/` so embedded user text can't terminate the script tag early.
  return JSON.stringify(persisted).replace(/<\/(script)/gi, '<\\/$1');
}

function rebuildHTML(state: WikiState): string {
  const json = serializeWikiState(state);
  const rx = /(<script\s+id="quire-data"[^>]*>)[\s\S]*?(<\/script>)/;
  // outerHTML strips DOCTYPE; prepend it manually.
  let html = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
  if (rx.test(html)) {
    html = html.replace(rx, `$1${json}$2`);
  } else {
    // Fallback: inject before </head>
    html = html.replace(
      /<\/head>/i,
      `<script id="quire-data" type="application/json">${json}</script></head>`,
    );
  }
  return html;
}

export class WikiPersistence {
  private dbPromise: Promise<IDBPDatabase<any>> | null = null;
  private listeners = new Set<(s: SaveStatus) => void>();
  private status: SaveStatus = {
    tier: 'C',
    state: 'saved',
    lastSaved: null,
    pendingChanges: 0,
  };
  private isWriting = false;
  private pendingState: WikiState | null = null;
  private channel: BroadcastChannel | null = null;
  public onRemoteUpdate: ((tier: Tier) => void) | null = null;
  public onRemoteUserUpdate: ((userId: UserID) => void) | null = null;

  constructor() {
    this.status.tier = this.detectTier();
    if (this.status.tier === 'C') this.status.state = 'browser-only';
  }

  private db() {
    if (!this.dbPromise) this.dbPromise = getDB();
    return this.dbPromise;
  }

  private notify() {
    const snapshot = { ...this.status };
    for (const fn of this.listeners) fn(snapshot);
  }

  subscribe(listener: (s: SaveStatus) => void): () => void {
    this.listeners.add(listener);
    listener({ ...this.status });
    return () => {
      this.listeners.delete(listener);
    };
  }

  getStatus(): SaveStatus {
    return { ...this.status };
  }

  setPendingChanges(n: number) {
    this.status.pendingChanges = n;
    if (this.status.tier === 'B' && n > 0 && this.status.state === 'saved') {
      this.status.state = 'dirty';
    }
    this.notify();
  }

  // ─── tier detection ────────────────────────────────────────────────────
  detectTier(): Tier {
    if (typeof window === 'undefined') return 'C';
    if (typeof indexedDB === 'undefined') return 'C';
    if ('showSaveFilePicker' in window) return 'A';
    return 'B';
  }

  // ─── load path ─────────────────────────────────────────────────────────
  loadFromHTML(): WikiState | null {
    try {
      const el = document.getElementById('quire-data');
      if (!el || !el.textContent) return null;
      const txt = el.textContent.trim();
      if (!txt || txt === '{}') return null;
      const obj = JSON.parse(txt);
      if (!obj || typeof obj !== 'object') return null;
      if (!obj.wikiId || !Array.isArray(obj.leaves)) return null;
      return migrateToV2(obj);
    } catch {
      return null;
    }
  }

  async loadDraftFromIDB(wikiId: string): Promise<WikiState | null> {
    try {
      const db = await this.db();
      const rec = await db.get(STORE_DRAFTS, `draft:${wikiId}`);
      if (rec && rec.state) return migrateToV2(rec.state);
      return null;
    } catch {
      return null;
    }
  }

  // ─── identity ─────────────────────────────────────────────────────────
  async getCurrentUserId(wikiId: string): Promise<UserID | null> {
    try {
      const db = await this.db();
      const rec = await db.get(STORE_IDENTITY, `identity:${wikiId}`);
      if (rec && rec.currentUserId) return rec.currentUserId as UserID;
      return null;
    } catch {
      return null;
    }
  }

  async setCurrentUserId(wikiId: string, userId: UserID): Promise<void> {
    try {
      const db = await this.db();
      await db.put(STORE_IDENTITY, { wikiId, currentUserId: userId }, `identity:${wikiId}`);
    } catch (err) {
      console.warn('setCurrentUserId failed', err);
    }
  }

  async clearIdentity(wikiId: string): Promise<void> {
    try {
      const db = await this.db();
      await db.delete(STORE_IDENTITY, `identity:${wikiId}`);
    } catch {
      // ignore
    }
  }

  // ─── tier A — file handle ─────────────────────────────────────────────
  async hasStoredHandle(wikiId: string): Promise<boolean> {
    if (this.status.tier !== 'A') return false;
    try {
      const db = await this.db();
      const h = await db.get(STORE_HANDLES, `fileHandle:${wikiId}`);
      return !!h;
    } catch {
      return false;
    }
  }

  async getStoredHandle(wikiId: string): Promise<FileSystemFileHandle | null> {
    try {
      const db = await this.db();
      const h = await db.get(STORE_HANDLES, `fileHandle:${wikiId}`);
      return (h as FileSystemFileHandle) || null;
    } catch {
      return null;
    }
  }

  async connectFile(wikiId: string): Promise<void> {
    if (this.status.tier !== 'A') throw new Error('File System Access API unavailable');
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: 'quire.html',
      types: [
        {
          description: 'Quire wiki',
          accept: { 'text/html': ['.html'] },
        },
      ],
    });
    const db = await this.db();
    await db.put(STORE_HANDLES, handle, `fileHandle:${wikiId}`);
  }

  async verifyHandle(wikiId: string): Promise<boolean> {
    const handle = await this.getStoredHandle(wikiId);
    if (!handle) return false;
    try {
      const perm = await (handle as any).queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') return true;
      if (perm === 'prompt') {
        const req = await (handle as any).requestPermission({ mode: 'readwrite' });
        return req === 'granted';
      }
      return false;
    } catch {
      return false;
    }
  }

  async writeToHandle(wikiId: string, html: string): Promise<void> {
    const handle = await this.getStoredHandle(wikiId);
    if (!handle) throw new Error('No stored handle');
    const writable = await (handle as any).createWritable();
    try {
      await writable.write(html);
    } finally {
      await writable.close();
    }
  }

  async clearStoredHandle(wikiId: string): Promise<void> {
    try {
      const db = await this.db();
      await db.delete(STORE_HANDLES, `fileHandle:${wikiId}`);
    } catch {
      // ignore
    }
  }

  // ─── tier B — manual download ─────────────────────────────────────────
  downloadHTML(html: string, filename: string): void {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'quire.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ─── always-on draft ──────────────────────────────────────────────────
  async saveDraftToIDB(state: WikiState): Promise<void> {
    try {
      const db = await this.db();
      await db.put(
        STORE_DRAFTS,
        { state, lastSaved: new Date().toISOString() },
        `draft:${state.wikiId}`,
      );
    } catch (err) {
      console.warn('saveDraftToIDB failed', err);
    }
  }

  async clearDraftFromIDB(wikiId: string): Promise<void> {
    try {
      const db = await this.db();
      await db.delete(STORE_DRAFTS, `draft:${wikiId}`);
    } catch {
      // ignore
    }
  }

  // ─── unified save entry ───────────────────────────────────────────────
  async save(state: WikiState): Promise<SaveStatus> {
    if (this.status.tier === 'A') return this.saveTierA(state);
    return this.saveTierB(state);
  }

  private async saveTierA(state: WikiState): Promise<SaveStatus> {
    // Always write the IDB draft as a safety net.
    await this.saveDraftToIDB(state);

    // Coalesce concurrent writes via simple mutex.
    if (this.isWriting) {
      this.pendingState = state;
      return this.status;
    }

    const handle = await this.getStoredHandle(state.wikiId);
    if (!handle) {
      // No connection yet — Tier A "armed" but waiting for user. Show dirty.
      this.status = {
        ...this.status,
        state: 'dirty',
        pendingChanges: this.status.pendingChanges + 1,
      };
      this.notify();
      return this.status;
    }

    this.isWriting = true;
    this.status = { ...this.status, state: 'saving' };
    this.notify();

    try {
      const html = rebuildHTML(state);
      await this.writeToHandle(state.wikiId, html);
      const now = new Date().toISOString();
      this.status = {
        tier: 'A',
        state: 'saved',
        lastSaved: now,
        pendingChanges: 0,
      };
      // Keep an up-to-date draft (so a future tab opening this file gets the latest).
      await this.saveDraftToIDB({ ...state, lastSaved: now });
      this.broadcastUpdate();
    } catch (err: any) {
      console.error('Tier A write failed', err);
      this.status = {
        ...this.status,
        state: 'error',
        errorMessage: err?.message || String(err),
      };
    } finally {
      this.isWriting = false;
      this.notify();
      if (this.pendingState) {
        const next = this.pendingState;
        this.pendingState = null;
        // tail-call without await to avoid stack growth
        this.saveTierA(next);
      }
    }
    return this.status;
  }

  private async saveTierB(state: WikiState): Promise<SaveStatus> {
    // Tier B: every state change just writes IDB. Manual save downloads HTML.
    try {
      this.status = { ...this.status, state: 'saving' };
      this.notify();
      await this.saveDraftToIDB(state);
      // For Tier B we leave state as 'dirty' if pendingChanges > 0,
      // and the bookkeeping of pendingChanges is done by the caller.
      this.status = {
        ...this.status,
        state: this.status.pendingChanges > 0 ? 'dirty' : 'saved',
      };
    } catch (err: any) {
      this.status = {
        ...this.status,
        state: 'error',
        errorMessage: err?.message || String(err),
      };
    }
    this.notify();
    return this.status;
  }

  async manualDownload(state: WikiState, filename = 'quire.html'): Promise<void> {
    const html = rebuildHTML(state);
    this.downloadHTML(html, filename);
    const now = new Date().toISOString();
    this.status = {
      ...this.status,
      state: 'saved',
      lastSaved: now,
      pendingChanges: 0,
    };
    await this.saveDraftToIDB({ ...state, lastSaved: now });
    this.notify();
    this.broadcastUpdate();
  }

  buildHTML(state: WikiState): string {
    return rebuildHTML(state);
  }

  // ─── exports ──────────────────────────────────────────────────────────
  async exportSnapshot(state: WikiState): Promise<void> {
    const html = rebuildHTML(state);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    this.downloadHTML(html, `quire-${stamp}.html`);
  }

  async exportMarkdown(state: WikiState): Promise<void> {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    for (const leaf of state.leaves) {
      const fm =
        '---\n' +
        `id: ${leaf.id}\n` +
        `title: ${JSON.stringify(leaf.title)}\n` +
        `tags: [${leaf.tags.join(', ')}]\n` +
        `created: ${leaf.created}\n` +
        `edited: ${leaf.edited}\n` +
        (leaf.pinned ? 'pinned: true\n' : '') +
        (leaf.isJournal ? 'journal: true\n' : '') +
        '---\n\n';
      const safeName = (leaf.title || leaf.id).replace(/[^a-zA-Z0-9-_ ]/g, '_').slice(0, 80);
      zip.file(`${safeName || leaf.id}.md`, fm + (leaf.body || ''));
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quire-markdown.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async exportJSON(state: WikiState): Promise<void> {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quire-state.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ─── cross-tab coordination ───────────────────────────────────────────
  initBroadcast(wikiId: string) {
    try {
      this.channel = new BroadcastChannel(`quire:${wikiId}`);
      this.channel.onmessage = (ev) => {
        if (ev.data?.type === 'updated') {
          this.onRemoteUpdate?.(this.status.tier);
        } else if (ev.data?.type === 'userUpdated' && ev.data?.userId) {
          this.onRemoteUserUpdate?.(ev.data.userId);
        }
      };
    } catch {
      this.channel = null;
    }
  }

  private broadcastUpdate() {
    try {
      this.channel?.postMessage({ type: 'updated', at: new Date().toISOString() });
    } catch {
      // ignore
    }
  }

  broadcastUserUpdate(userId: UserID) {
    try {
      this.channel?.postMessage({ type: 'userUpdated', userId });
    } catch {
      // ignore
    }
  }

  // ─── beforeunload guard ──────────────────────────────────────────────
  installBeforeUnloadGuard(getPending: () => number) {
    const handler = (e: BeforeUnloadEvent) => {
      if (getPending() > 0) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
      return undefined;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }

  setStatus(partial: Partial<SaveStatus>) {
    this.status = { ...this.status, ...partial };
    this.notify();
  }
}

export const persistence = new WikiPersistence();
