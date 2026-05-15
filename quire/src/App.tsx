import { useCallback, useEffect, useMemo, useState, DragEvent } from 'react';
import { useCurrentUser, useWikiStore } from './store/useWikiStore';
import { persistence } from './store/persistence';
// welcomeLeaf seeded default removed in v1.6.1 — empty initial state instead
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { LeafCard } from './components/LeafCard';
import { CommandPalette, PaletteCommand } from './components/CommandPalette';
import { SettingsDrawer } from './components/SettingsDrawer';
import { ToastStack } from './components/Toast';
import { Icon } from './components/Icon';
// UserOnboardingModal removed in v1.6.1 — author attribution is now opt-in
import { AuthorChip } from './components/AuthorChip';
import { TasksView } from './components/TasksView';
import { ShortcutHelpDialog } from './components/ShortcutHelpDialog';
import { LockOverlay } from './components/LockOverlay';
import { PasswordSetupDialog } from './components/PasswordSetupDialog';
import { ChangePasswordDialog } from './components/ChangePasswordDialog';
import { SidebarDrawer } from './components/SidebarDrawer';
import { ImportDialog } from './components/ImportDialog';
import { ExportJSONDialog } from './components/ExportJSONDialog';
import { IntroCard } from './components/IntroCard';
import { DebugPanel } from './components/DebugPanel';
import {
  FolderContextMenu,
  useFolderContextMenuState,
} from './components/FolderContextMenu';
import { FolderEncryptDialog } from './components/FolderEncryptDialog';
import { FolderChangePasswordDialog } from './components/FolderChangePasswordDialog';
import { FolderUnlockCard } from './components/FolderUnlockCard';
import { useIsMobile } from './lib/useMediaQuery';
import {
  closestProtectedAncestor,
  leavesInFolder as leavesInFolderHelper,
} from './lib/folders';
import {
  decryptLeafBody,
  encryptForFolder,
  lockFolder as lockFolderKey,
  makeFolderProtection,
  unlockFolderKey,
  verifyFolderPassword,
} from './lib/folderCrypto';
import {
  clearAllFolderKeys,
  isFolderUnlocked,
  subscribeFolderTick,
} from './lib/lockState';
import { buildIndex, tagCounts } from './lib/wikilinks';
import { formatBytes, formatRel, uuid } from './lib/utils';
import { ShortcutAction, setShortcutsSuppressed, useShortcuts } from './lib/hotkeys';
import { findUser, leafCountsByAuthor, migrateToV2 } from './lib/users';
import { migrateToV3 } from './lib/migrate';
import { ActivityMonitor } from './lib/activityMonitor';
import {
  clearDecryptionCache,
  decryptedBodyCache,
  setCryptoKey,
  useLockState,
} from './lib/lockState';
import {
  calibrateIterations,
  decryptString,
  deriveKey,
  encryptString,
  isEncryptedField,
  makeVerifier,
  randomSaltB64,
  verifyPassword,
} from './lib/crypto';
import { detectFilenameFromLocation } from './lib/filename';
import { computeDocumentTitle } from './lib/documentTitle';
import type {
  AccentName,
  ActiveFilter,
  AutolockConfig,
  EncryptedField,
  FontPair,
  ProtectionConfig,
  ThemeName,
  UserID,
  WikiState,
} from './types';
import { DEFAULT_SETTINGS } from './types';

const ACCENTS: Record<AccentName, string> = {
  ochre: 'oklch(0.62 0.12 70)',
  sage: 'oklch(0.58 0.08 150)',
  indigo: 'oklch(0.55 0.12 280)',
  rust: 'oklch(0.55 0.14 30)',
  plum: 'oklch(0.5  0.12 330)',
};

const FONT_PAIRS: Record<FontPair, { head: string; body: string; mono: string }> = {
  editorial: {
    head: 'Georgia, "Spectral", serif',
    body: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    mono: 'ui-monospace, "JetBrains Mono", "IBM Plex Mono", monospace',
  },
  modern: {
    head: 'system-ui, -apple-system, "IBM Plex Sans", sans-serif',
    body: 'system-ui, -apple-system, "IBM Plex Sans", sans-serif',
    mono: 'ui-monospace, "JetBrains Mono", monospace',
  },
  classic: {
    head: 'Georgia, "Spectral", serif',
    body: 'Georgia, "Spectral", serif',
    mono: 'ui-monospace, "IBM Plex Mono", monospace',
  },
  terminal: {
    head: 'ui-monospace, "JetBrains Mono", monospace',
    body: 'ui-monospace, "JetBrains Mono", monospace',
    mono: 'ui-monospace, "JetBrains Mono", monospace',
  },
};

const THEMES: Record<ThemeName, Record<string, string>> = {
  paper: {
    '--q-bg': '#f5efe2',
    '--q-bg-2': '#efe7d4',
    '--q-surface': '#fdfaf2',
    '--q-surface-2': '#f9f3e3',
    '--q-ink': '#2b2620',
    '--q-ink-2': '#574e42',
    '--q-dim': '#8c8474',
    '--q-line': '#e6dec9',
    '--q-line-2': '#d6cdb6',
    '--q-shadow':
      '0 1px 0 rgba(255,255,255,.6) inset, 0 1px 2px rgba(60,40,10,.06), 0 18px 40px -22px rgba(60,40,10,.18)',
    '--q-shadow-focused':
      '0 1px 0 rgba(255,255,255,.7) inset, 0 2px 4px rgba(60,40,10,.08), 0 24px 50px -22px rgba(60,40,10,.28)',
    '--q-paper-grain': '0',
    '--q-overdue': 'oklch(0.55 0.16 25)',
  },
  ink: {
    '--q-bg': '#14130f',
    '--q-bg-2': '#0e0d0a',
    '--q-surface': '#1c1a15',
    '--q-surface-2': '#23201a',
    '--q-ink': '#ece5d4',
    '--q-ink-2': '#b9b09a',
    '--q-dim': '#7a7264',
    '--q-line': '#2a2620',
    '--q-line-2': '#3a342b',
    '--q-shadow': '0 1px 0 rgba(255,255,255,.04) inset, 0 18px 40px -22px rgba(0,0,0,.6)',
    '--q-shadow-focused':
      '0 1px 0 rgba(255,255,255,.06) inset, 0 24px 50px -22px rgba(0,0,0,.8)',
    '--q-paper-grain': '0',
    '--q-overdue': 'oklch(0.65 0.16 25)',
  },
  mono: {
    '--q-bg': '#ffffff',
    '--q-bg-2': '#fafafa',
    '--q-surface': '#ffffff',
    '--q-surface-2': '#f7f7f7',
    '--q-ink': '#0b0b0b',
    '--q-ink-2': '#3a3a3a',
    '--q-dim': '#888888',
    '--q-line': '#0b0b0b',
    '--q-line-2': '#cfcfcf',
    '--q-shadow': 'none',
    '--q-shadow-focused': '0 0 0 1.5px #0b0b0b',
    '--q-paper-grain': '0',
    '--q-overdue': '#0b0b0b',
  },
};

interface RestorePromptState {
  open: boolean;
  draftLastSaved: string | null;
  onRestore: () => void;
  onDiscard: () => void;
}

export default function App() {
  const store = useWikiStore();
  const {
    leaves,
    openIds,
    focusedId,
    settings,
    users,
    currentUserId,
    activeFilter,
    paletteOpen,
    paletteQuery,
    editingId,
    settingsOpen,
    toasts,
    onboardingDismissed,
    saveStatus,
    remoteUpdateAvailable,
    protection,
    autolock,
  } = store;
  const currentUser = useCurrentUser();
  const lockState = useLockState();

  const [hydrated, setHydrated] = useState(false);
  const [restore, setRestore] = useState<RestorePromptState | null>(null);
  const [hasFileHandle, setHasFileHandle] = useState(false);
  const [originalFilename] = useState<string>('quire.html');
  const [fileSize, setFileSize] = useState<number>(0);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [tasksFocused, setTasksFocused] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [changePwdOpen, setChangePwdOpen] = useState<null | 'change' | 'disable'>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importInitialFile, setImportInitialFile] = useState<File | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportStats, setExportStats] = useState<{
    plaintext: number;
    encrypted: number;
    masterProtected: boolean;
  } | null>(null);
  const [introCardVariant, setIntroCardVariant] = useState<
    'seeded' | 'empty' | null
  >(null);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [dropOverlayActive, setDropOverlayActive] = useState(false);
  const folderMenu = useFolderContextMenuState();
  const [folderEncryptTarget, setFolderEncryptTarget] = useState<string | null>(null);
  const [folderChangePwdTarget, setFolderChangePwdTarget] = useState<{
    folderId: string;
    variant: 'change' | 'disable';
  } | null>(null);
  const [folderUnlockTarget, setFolderUnlockTarget] = useState<string | null>(null);
  const [folderTick, setFolderTick] = useState(0);
  // Subscribe to folder lock changes so the UI re-renders.
  useEffect(() => subscribeFolderTick(() => setFolderTick((n) => n + 1)), []);
  void folderTick;
  const [shortcutHintShown, setShortcutHintShown] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [navHistory, setNavHistory] = useState<string[]>([]);
  const isMobile = useIsMobile();
  const [baselineLeafCount, setBaselineLeafCount] = useState<number | null>(null);

  // ─── lock helpers (defined before useEffects so handlers can reference them)
  const doLockNow = useCallback(() => {
    if (lockState.locked) return;
    const snapshot = {
      paletteOpen: useWikiStore.getState().paletteOpen,
      settingsOpen: useWikiStore.getState().settingsOpen,
      tasksOpen,
      editingId: useWikiStore.getState().editingId,
      focusedId: useWikiStore.getState().focusedId,
    };
    // Wipe the key + cache via the lockState action
    setCryptoKey(null);
    clearDecryptionCache();
    useLockState.getState().lock(snapshot);
    // Broadcast to other tabs
    persistence.broadcastLock?.(useWikiStore.getState().wikiId);
  }, [lockState.locked, tasksOpen]);

  const monitorRef = useState<{ m: ActivityMonitor | null }>(() => ({ m: null }))[0];

  // ─── unlock (password mode) ───────────────────────────────────────────
  const onUnlockPassword = useCallback(
    async (password: string): Promise<boolean> => {
      const cur = useWikiStore.getState().protection;
      try {
        const key = await verifyPassword(password, cur);
        if (!key) {
          useLockState.getState().recordFailure();
          return false;
        }
        setCryptoKey(key);
        useLockState.getState().unlock();
        return true;
      } catch (err) {
        console.error('verify error', err);
        useLockState.getState().recordFailure();
        return false;
      }
    },
    [],
  );

  const onCurtainDismiss = useCallback(() => {
    useLockState.getState().unlock();
  }, []);

  // ─── enable / change / disable password ───────────────────────────────
  const onEnablePassword = useCallback(() => setSetupOpen(true), []);
  const onChangePassword = useCallback(() => setChangePwdOpen('change'), []);
  const onDisablePassword = useCallback(() => setChangePwdOpen('disable'), []);

  // ─── folder menu actions ─────────────────────────────────────────────
  const folderActions = useMemo(
    () => ({
      onNewSubfolder: (f: any) => {
        const name = window.prompt(`New folder under "${f.name}"`, 'Folder');
        if (!name) return;
        store.createFolder(name.trim() || 'Folder', f.id);
      },
      onRename: (f: any) => {
        const name = window.prompt('Rename folder', f.name);
        if (!name) return;
        store.renameFolder(f.id, name.trim() || f.name);
      },
      onMove: (f: any) => {
        const allFolders = useWikiStore.getState().folders;
        const candidates = allFolders.filter((other) => other.id !== f.id);
        const choice = window.prompt(
          `Move "${f.name}" to which folder?\n(leave blank for root, or type the name)`,
          '',
        );
        if (choice === null) return;
        const target = choice.trim();
        if (!target) {
          store.moveFolder(f.id, null);
          return;
        }
        const match = candidates.find(
          (c) => c.name.toLowerCase() === target.toLowerCase(),
        );
        if (!match) {
          alert(`No folder named "${target}".`);
          return;
        }
        const ok = store.moveFolder(f.id, match.id);
        if (!ok) alert('Cannot move a folder into itself or its descendants.');
      },
      onChangeIcon: (f: any) => {
        const icon = window.prompt(
          'Folder icon (single emoji or character; leave blank for default)',
          f.icon || '',
        );
        if (icon === null) return;
        store.setFolderIcon(f.id, icon.trim() || null);
      },
      onEncrypt: (f: any) => setFolderEncryptTarget(f.id),
      onChangePassword: (f: any) =>
        setFolderChangePwdTarget({ folderId: f.id, variant: 'change' }),
      onDisableProtection: (f: any) =>
        setFolderChangePwdTarget({ folderId: f.id, variant: 'disable' }),
      onLockNow: (f: any) => {
        const allLeaves = useWikiStore.getState().leaves;
        lockFolderKey(f, allLeaves);
      },
      onDelete: (f: any) => {
        const folderObj = useWikiStore
          .getState()
          .folders.find((x) => x.id === f.id);
        if (!folderObj) return;
        const childLeafCount = useWikiStore
          .getState()
          .leaves.filter((l) => l.folderId === f.id).length;
        const cascade = window.confirm(
          `Delete "${f.name}"?\n\n` +
            `OK = also delete its leaves and sub-folders (cascade).\n` +
            `Cancel = orphan leaves to "All notes" and promote sub-folders to root.\n\n` +
            (childLeafCount > 5
              ? `WARNING: cascade would delete ${childLeafCount}+ leaves.`
              : ''),
        );
        store.deleteFolder(f.id, cascade ? 'cascade' : 'orphan');
      },
    }),
    [store],
  );

  const commitSetup = useCallback(
    async (r: {
      password: string;
      lockTitle: string;
      lockSubtitle: string;
      hideIdentifyingInfo: boolean;
    }) => {
      // Calibrate iterations on this device
      const iterations = await calibrateIterations(500);
      const salt = randomSaltB64();
      const key = await deriveKey(r.password, salt, iterations);
      const verifier = await makeVerifier(key);
      // Encrypt every plaintext leaf body
      const leavesNow = useWikiStore.getState().leaves;
      const encryptedEntries: { id: string; body: EncryptedField }[] = [];
      for (const l of leavesNow) {
        const text = typeof l.body === 'string' ? l.body : '';
        const enc = await encryptString(text || '', key);
        encryptedEntries.push({ id: l.id, body: enc });
        // Cache plaintext so the user keeps reading without a re-decrypt
        if (text) decryptedBodyCache.set(l.id, text);
      }
      // Set the new key BEFORE writing the new state, so the auto-save can
      // encrypt edits that arrive concurrently.
      setCryptoKey(key);
      // Build new protection config
      const newProtection: ProtectionConfig = {
        mode: 'password',
        salt,
        iterations,
        hash: 'SHA-256',
        verifier,
        lockTitle: r.lockTitle || undefined,
        lockSubtitle: r.lockSubtitle || undefined,
        hideIdentifyingInfo: r.hideIdentifyingInfo,
      };
      useWikiStore.getState().setProtection(newProtection);
      useWikiStore.getState().setLeafBodies(encryptedEntries);
      useLockState.getState().setMode('password');
      setSetupOpen(false);
      // Force-save to flush new state to file
      try {
        await persistence.save(useWikiStore.getState().getPersistableState());
      } catch (err) {
        console.warn('save after enable failed', err);
      }
      // Lock immediately so the user re-verifies their password
      doLockNow();
    },
    [doLockNow],
  );

  const commitChangePassword = useCallback(
    async ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword?: string;
    }) => {
      const cur = useWikiStore.getState().protection;
      const oldKey = await verifyPassword(currentPassword, cur);
      if (!oldKey) throw new Error('Current password is incorrect.');

      if (changePwdOpen === 'disable') {
        // Decrypt every leaf body to plaintext, switch to curtain mode
        const leavesNow = useWikiStore.getState().leaves;
        const decryptedEntries: { id: string; body: string }[] = [];
        for (const l of leavesNow) {
          if (typeof l.body === 'string') {
            decryptedEntries.push({ id: l.id, body: l.body });
          } else if (isEncryptedField(l.body)) {
            const pt = await decryptString(l.body, oldKey);
            decryptedEntries.push({ id: l.id, body: pt });
          }
        }
        setCryptoKey(null);
        clearDecryptionCache();
        useWikiStore
          .getState()
          .setProtection({
            mode: 'curtain',
            lockTitle: cur.lockTitle,
            lockSubtitle: cur.lockSubtitle,
            hideIdentifyingInfo: cur.hideIdentifyingInfo,
          });
        useWikiStore.getState().setLeafBodies(decryptedEntries);
        useLockState.getState().setMode('curtain');
        setChangePwdOpen(null);
        await persistence.save(useWikiStore.getState().getPersistableState());
        return;
      }

      // change → re-encrypt with new key
      if (!newPassword) throw new Error('New password missing');
      const iterations = await calibrateIterations(500);
      const salt = randomSaltB64();
      const newKey = await deriveKey(newPassword, salt, iterations);
      const verifier = await makeVerifier(newKey);
      const leavesNow = useWikiStore.getState().leaves;
      const reEncrypted: { id: string; body: EncryptedField }[] = [];
      for (const l of leavesNow) {
        const pt =
          typeof l.body === 'string'
            ? l.body
            : isEncryptedField(l.body)
              ? await decryptString(l.body, oldKey)
              : '';
        reEncrypted.push({ id: l.id, body: await encryptString(pt, newKey) });
      }
      setCryptoKey(newKey);
      clearDecryptionCache();
      useWikiStore.getState().setProtection({
        ...cur,
        salt,
        iterations,
        hash: 'SHA-256',
        verifier,
      });
      useWikiStore.getState().setLeafBodies(reEncrypted);
      setChangePwdOpen(null);
      await persistence.save(useWikiStore.getState().getPersistableState());
      doLockNow();
    },
    [changePwdOpen, doLockNow],
  );

  const verifyCurrentPwd = useCallback(async (pwd: string) => {
    const cur = useWikiStore.getState().protection;
    try {
      const k = await verifyPassword(pwd, cur);
      return !!k;
    } catch {
      return false;
    }
  }, []);

  // ─── folder encryption commits ───────────────────────────────────────
  const commitFolderEncrypt = useCallback(
    async (args: { password: string; hideName: boolean; hideContents: boolean }) => {
      const folderId = folderEncryptTarget;
      if (!folderId) return;
      const all = useWikiStore.getState();
      const folder = all.folders.find((f) => f.id === folderId);
      if (!folder) return;
      const { key, protection } = await makeFolderProtection(
        args.password,
        args.hideName,
        args.hideContents,
      );
      // Determine which leaves get re-encrypted with this folder's key:
      // every leaf whose closest enclosing protected ancestor (after we add
      // this folder's protection) is THIS folder. That's: any leaf in this
      // folder or any descendant, NOT inside a separately-protected sub-folder.
      const protectedDescendants = all.folders.filter(
        (f) => f.id !== folder.id && !!f.protection,
      );
      const blockedSubtreeIds = new Set<string>();
      for (const pf of protectedDescendants) {
        // collect descendants of pf (inclusive)
        const queue = [pf.id];
        while (queue.length) {
          const cur = queue.shift()!;
          blockedSubtreeIds.add(cur);
          for (const f of all.folders) {
            if (f.parentId === cur && !blockedSubtreeIds.has(f.id))
              queue.push(f.id);
          }
        }
      }
      // descendants of `folder`
      const targetSubtree = new Set<string>([folder.id]);
      const queue2 = [folder.id];
      while (queue2.length) {
        const cur = queue2.shift()!;
        for (const f of all.folders) {
          if (f.parentId === cur && !targetSubtree.has(f.id)) {
            targetSubtree.add(f.id);
            queue2.push(f.id);
          }
        }
      }
      const leavesToEncrypt = all.leaves.filter(
        (l) =>
          l.folderId &&
          targetSubtree.has(l.folderId) &&
          !blockedSubtreeIds.has(l.folderId),
      );
      // Cache the folder key so encryption + later reads work
      unlockFolderKey(folder, key);
      const entries: { id: string; body: any }[] = [];
      for (const l of leavesToEncrypt) {
        const pt = typeof l.body === 'string' ? l.body : '';
        const enc = await encryptForFolder(all.folders, l.folderId || null, pt);
        entries.push({ id: l.id, body: enc });
      }
      // Save protection + encrypted leaves
      store.setFolderProtection(folder.id, protection);
      store.setLeafBodies(entries);
      setFolderEncryptTarget(null);
      // Lock immediately so user re-verifies
      lockFolderKey(folder, all.leaves);
      try {
        await persistence.save(useWikiStore.getState().getPersistableState());
      } catch (err) {
        console.warn('save after folder encrypt failed', err);
      }
    },
    [folderEncryptTarget, store],
  );

  const verifyFolderPwdAdapter = useCallback(
    async (folder: any, pwd: string) => {
      try {
        const k = await verifyFolderPassword(folder, pwd);
        return !!k;
      } catch {
        return false;
      }
    },
    [],
  );

  const commitFolderChangePassword = useCallback(
    async ({
      folder,
      currentPassword,
      newPassword,
    }: {
      folder: any;
      currentPassword: string;
      newPassword?: string;
    }) => {
      const oldKey = await verifyFolderPassword(folder, currentPassword);
      if (!oldKey) throw new Error('Current password is incorrect.');
      unlockFolderKey(folder, oldKey);

      const all = useWikiStore.getState();
      const variant = folderChangePwdTarget?.variant || 'change';

      // Find leaves directly protected by this folder's key (i.e., closest
      // protected ancestor === this folder).
      const protectedByThis = all.leaves.filter(
        (l) =>
          closestProtectedAncestor(all.folders, l.folderId || null)?.id ===
          folder.id,
      );

      if (variant === 'disable') {
        // Decrypt with old key.
        const decrypted: { id: string; body: any }[] = [];
        for (const l of protectedByThis) {
          const pt = await decryptLeafBody(all.folders, l);
          decrypted.push({ id: l.id, body: pt ?? '' });
        }
        // Remove protection
        store.setFolderProtection(folder.id, undefined);
        // After removing protection, leaves' new closest enclosing protected
        // ancestor may be the parent. Re-encrypt with that parent's key, if any.
        const updated = useWikiStore.getState().folders;
        const reEntries: { id: string; body: any }[] = [];
        for (const e of decrypted) {
          const leaf = all.leaves.find((l) => l.id === e.id)!;
          const enc = closestProtectedAncestor(updated, leaf.folderId || null);
          if (enc) {
            const body = await encryptForFolder(updated, leaf.folderId || null, e.body);
            reEntries.push({ id: e.id, body });
          } else {
            reEntries.push({ id: e.id, body: e.body });
          }
        }
        store.setLeafBodies(reEntries);
        // Wipe key
        lockFolderKey(folder, useWikiStore.getState().leaves);
        setFolderChangePwdTarget(null);
        await persistence.save(useWikiStore.getState().getPersistableState());
        return;
      }

      // change
      if (!newPassword) throw new Error('New password missing');
      const { key: newKey, protection } = await makeFolderProtection(
        newPassword,
        !!folder.protection?.hideName,
        !!folder.protection?.hideContents,
      );
      // Decrypt with the old key first; collect plaintexts before swapping keys.
      const plaintexts: { id: string; pt: string }[] = [];
      for (const l of protectedByThis) {
        const pt = await decryptLeafBody(all.folders, l);
        plaintexts.push({ id: l.id, pt: pt ?? '' });
      }
      // Now switch to the new key and re-encrypt.
      unlockFolderKey(folder, newKey);
      const reEntries: { id: string; body: any }[] = [];
      for (const { id, pt } of plaintexts) {
        const l = protectedByThis.find((x) => x.id === id)!;
        const enc = await encryptForFolder(all.folders, l.folderId || null, pt);
        reEntries.push({ id: l.id, body: enc });
      }
      store.setFolderProtection(folder.id, protection);
      store.setLeafBodies(reEntries);
      setFolderChangePwdTarget(null);
      // Lock so the user re-verifies
      lockFolderKey(folder, useWikiStore.getState().leaves);
      await persistence.save(useWikiStore.getState().getPersistableState());
    },
    [folderChangePwdTarget, store],
  );

  const handleFolderUnlock = useCallback(
    async (password: string): Promise<boolean> => {
      if (!folderUnlockTarget) return false;
      const f = useWikiStore
        .getState()
        .folders.find((x) => x.id === folderUnlockTarget);
      if (!f) return false;
      const key = await verifyFolderPassword(f, password);
      if (!key) return false;
      unlockFolderKey(f, key);
      setFolderUnlockTarget(null);
      return true;
    },
    [folderUnlockTarget],
  );

  // When the user clicks into a locked folder, surface the unlock card.
  // Hooked from FolderTree onFilterFolder.
  const onFolderFilterClick = useCallback(
    (fid: string | null, deep: boolean) => {
      if (fid === null) {
        store.setActiveFilter(null);
        return;
      }
      const folder = useWikiStore.getState().folders.find((f) => f.id === fid);
      if (folder?.protection && !isFolderUnlocked(fid)) {
        setFolderUnlockTarget(fid);
        return;
      }
      store.setActiveFilter({ type: 'folder', value: fid, deep });
    },
    [store],
  );

  // Wipe folder keys on activity-monitor lock.
  useEffect(() => {
    const wipeOnLock = () => clearAllFolderKeys();
    // The existing doLockNow already wipes the master key; piggy-back via
    // subscribing to lockState's locked transition.
    const unsub = useLockState.subscribe((s, prev) => {
      if (s.locked && !prev.locked) wipeOnLock();
    });
    return unsub;
  }, []);

  // ─── boot sequence ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tier = persistence.detectTier();
      const fromHTML = persistence.loadFromHTML();
      // First-run detection: data block was missing/empty AND no IDB draft.
      void fromHTML; // first-run determination has moved to the IDB welcome flag check
      let baseState: WikiState =
        fromHTML ??
        migrateToV3(
          migrateToV2({
            schemaVersion: 1,
            wikiId: uuid(),
            leaves: [],
            openIds: [],
            focusedId: null,
            settings: DEFAULT_SETTINGS,
            lastSaved: new Date().toISOString(),
          }),
        );

      // If the file is password-protected, lock immediately *before* hydrate.
      const detectedFilename =
        detectFilenameFromLocation() || 'quire.html';
      useLockState.getState().setFilename(detectedFilename);
      useLockState.getState().setMode(baseState.protection.mode);
      if (baseState.protection.mode === 'password') {
        useLockState.getState().lock(null);
      }

      const draft = await persistence.loadDraftFromIDB(baseState.wikiId);
      const useDraft =
        draft && draft.lastSaved && baseState.lastSaved && draft.lastSaved > baseState.lastSaved;

      const finish = async (chosen: WikiState, usedDraft: boolean) => {
        if (cancelled) return;
        // Resolve current user identity for this browser.
        let savedId = await persistence.getCurrentUserId(chosen.wikiId);
        const userExists =
          savedId && chosen.users && chosen.users.some((u) => u.id === savedId);
        if (!userExists) savedId = null;
        store.hydrate(chosen, savedId);
        // NOTE: identity onboarding modal removed in v1.6.1. Author attribution
        // is now an opt-in Settings → "Author attribution" toggle. We don't
        // call setNeedsIdentity even if savedId is null.
        void savedId;
        const seenHint = await persistence.getMeta<boolean>('hint:shortcuts');
        setShortcutHintShown(!!seenHint);
        const debugFlag = await persistence.getMeta<boolean>('debug:enabled');
        setDebugPanelOpen(!!debugFlag);
        setBaselineLeafCount(chosen.leaves.length);
        setHydrated(true);
        // ─── Intro card logic (v1.6.1) ───────────────────────────────────
        // Show the card based on the welcome:{wikiId} flag, not on first-run
        // status. The variant depends on whether the wiki has content.
        if (chosen.protection.mode === 'password') {
          // Master-password lock screen handles its own UX; no intro card.
          setIntroCardVariant(null);
        } else {
          const flag = await persistence.getMeta<{ dismissed: boolean }>(
            `welcome:${chosen.wikiId}`,
          );
          if (flag?.dismissed) {
            setIntroCardVariant(null);
          } else if (chosen.leaves.length > 0) {
            // First boot for this wiki on this browser AND content is present.
            // Could be (a) fresh seeded wiki on quire.one, or (b) a v1.6 user
            // who hasn't had the dismissal flag set yet. Per spec: option (b)
            // should NOT see the card, so we set the flag silently. Heuristic:
            // if the wiki was already auto-saved at least once (i.e. there is
            // a draft or stored handle), it's an existing user — silence flag.
            const handleExists = await persistence.hasStoredHandle(chosen.wikiId);
            const draftExists = !!(await persistence.loadDraftFromIDB(chosen.wikiId));
            if (usedDraft || handleExists || draftExists) {
              await persistence.setMeta(`welcome:${chosen.wikiId}`, {
                dismissed: true,
                dismissedAt: new Date().toISOString(),
              });
              setIntroCardVariant(null);
            } else {
              setIntroCardVariant('seeded');
            }
          } else {
            // Empty wiki → empty variant.
            setIntroCardVariant('empty');
          }
        }
      };

      if (useDraft) {
        setRestore({
          open: true,
          draftLastSaved: draft!.lastSaved,
          onRestore: () => {
            finish(draft!, true);
            setRestore(null);
          },
          onDiscard: () => {
            persistence.clearDraftFromIDB(baseState.wikiId);
            finish(baseState, false);
            setRestore(null);
          },
        });
      } else {
        finish(baseState, false);
      }

      // Status pill subscription
      persistence.initBroadcast(baseState.wikiId);
      persistence.onRemoteUpdate = () => {
        useWikiStore.getState().setRemoteUpdateAvailable(true);
        useWikiStore.getState().pushToast({
          message: 'This file was updated in another tab. Reload to see latest.',
          ttl: 8000,
        });
      };
      persistence.onRemoteUserUpdate = () => {
        // Trigger a soft re-read by reloading state; in practice another tab's
        // user update lands via the file save → the broadcast above already
        // covers reload prompts. This handler exists to support future extensions.
      };
      persistence.onRemoteLock = () => {
        if (useLockState.getState().locked) return;
        setCryptoKey(null);
        clearDecryptionCache();
        useLockState.getState().lock(null);
      };

      // beforeunload: wipe key
      window.addEventListener('beforeunload', () => {
        setCryptoKey(null);
        clearDecryptionCache();
      });

      // Tier A: verify handle
      if (tier === 'A') {
        const has = await persistence.hasStoredHandle(baseState.wikiId);
        if (has) {
          const ok = await persistence.verifyHandle(baseState.wikiId);
          if (ok) {
            setHasFileHandle(true);
          } else {
            useWikiStore.getState().pushToast({
              message: 'Could not access the connected file. Falling back to manual save.',
              ttl: 6000,
              kind: 'error',
            });
          }
        }
      }

      // Tier C banner toast
      if (tier === 'C') {
        useWikiStore.getState().pushToast({
          message:
            'Browser blocks file access. Notes save in this browser only — export to JSON regularly to back up.',
          ttl: 12000,
          kind: 'error',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── activity monitor lifecycle ────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    if (lockState.locked) return;
    const onLock = () => {
      doLockNow();
    };
    const m = new ActivityMonitor(
      onLock,
      () => useWikiStore.getState().autolock.inactivityTimeoutMs,
      () => useWikiStore.getState().autolock.hiddenTimeoutMs,
    );
    monitorRef.m = m;
    m.start();
    return () => {
      m.stop();
      monitorRef.m = null;
    };
  }, [hydrated, lockState.locked, doLockNow]);

  // Re-trigger the inactivity scheduler when the timeouts change
  useEffect(() => {
    monitorRef.m?.reschedule();
  }, [autolock.inactivityTimeoutMs, autolock.hiddenTimeoutMs]);

  // Suppress global shortcuts while locked
  useEffect(() => {
    setShortcutsSuppressed(lockState.locked);
  }, [lockState.locked]);

  // ─── document.title ───────────────────────────────────────────────────
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = computeDocumentTitle({
      locked: lockState.locked,
      hideIdentifyingInfo: !!protection.hideIdentifyingInfo,
      lockTitle: protection.lockTitle,
      filename: lockState.filename,
    });
  }, [
    lockState.locked,
    protection.hideIdentifyingInfo,
    protection.lockTitle,
    lockState.filename,
  ]);

  // ─── global drag-and-drop for .json files ────────────────────────────
  useEffect(() => {
    let dragDepth = 0;
    const onDragEnter = (e: globalThis.DragEvent) => {
      if (!hydrated) return;
      // Only react to actual file drags.  Other drags (text, links) keep dragDepth at 0.
      const dt = e.dataTransfer;
      if (!dt) return;
      if (!Array.from(dt.types || []).includes('Files')) return;
      e.preventDefault();
      dragDepth++;
      if (dragDepth === 1) setDropOverlayActive(true);
    };
    const onDragOver = (e: globalThis.DragEvent) => {
      const dt = e.dataTransfer;
      if (dt && Array.from(dt.types || []).includes('Files')) {
        e.preventDefault();
      }
    };
    const onDragLeave = (e: globalThis.DragEvent) => {
      if (dragDepth === 0) return;
      dragDepth--;
      if (dragDepth === 0) setDropOverlayActive(false);
      void e;
    };
    const onDrop = (e: globalThis.DragEvent) => {
      const dt = e.dataTransfer;
      if (!dt) return;
      if (!Array.from(dt.types || []).includes('Files')) return;
      e.preventDefault();
      dragDepth = 0;
      setDropOverlayActive(false);
      const files = Array.from(dt.files || []);
      if (files.length === 0) return;
      if (files.length > 1) {
        useWikiStore.getState().pushToast({
          message: 'Drop a single file to import.',
          kind: 'error',
          ttl: 4000,
        });
        return;
      }
      const f = files[0];
      if (!f.name.toLowerCase().endsWith('.json')) {
        useWikiStore.getState().pushToast({
          message: 'Only Quire JSON files can be imported.',
          kind: 'error',
          ttl: 4000,
        });
        return;
      }
      setImportInitialFile(f);
      setImportDialogOpen(true);
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [hydrated]);

  // ─── apply an imported merged state ──────────────────────────────────
  const onApplyImport = useCallback(
    async (merged: WikiState, alsoBackupCurrent: boolean) => {
      if (alsoBackupCurrent) {
        try {
          await persistence.exportJSON(
            useWikiStore.getState().getPersistableState(),
          );
        } catch (err) {
          console.warn('backup-before-import failed', err);
        }
      }
      store.applyMergedState(merged);
      setImportDialogOpen(false);
      setImportInitialFile(null);
      setIntroCardVariant(null);
      // Persist the welcome dismissal since the user has now imported content
      void persistence.setMeta(`welcome:${merged.wikiId}`, {
        dismissed: true,
        dismissedAt: new Date().toISOString(),
      });
      useWikiStore.getState().pushToast({
        message: `Imported ${merged.leaves.length} leaves.`,
        ttl: 6000,
      });
    },
    [store],
  );

  // ─── export-to-JSON with plaintext warning ───────────────────────────
  const openExportDialog = useCallback(async () => {
    const stats = await persistence.previewExportStats(
      useWikiStore.getState().getPersistableState(),
    );
    setExportStats(stats);
    setExportDialogOpen(true);
  }, []);
  const confirmExport = useCallback(async () => {
    await persistence.exportJSON(useWikiStore.getState().getPersistableState());
    setExportDialogOpen(false);
  }, []);

  // ─── first-time shortcut hint ──────────────────────────────────────────
  useEffect(() => {
    if (!hydrated || shortcutHintShown || baselineLeafCount === null) return;
    if (leaves.length - baselineLeafCount >= 2) {
      setShortcutHintShown(true);
      persistence.setMeta('hint:shortcuts', true);
      useWikiStore.getState().pushToast({
        message: 'Tip · press ? anytime to see keyboard shortcuts.',
        ttl: 6000,
      });
    }
  }, [hydrated, shortcutHintShown, baselineLeafCount, leaves.length]);

  // ─── window.quireDebug (only while debug panel enabled) ────────────────
  useEffect(() => {
    if (!debugPanelOpen) {
      delete (window as any).quireDebug;
      return;
    }
    (window as any).quireDebug = {
      state: () => useWikiStore.getState(),
      status: () => persistence.getStatus(),
      forceLoad: () => persistence.loadFromHTML(),
      forceSave: () =>
        persistence.save(useWikiStore.getState().getPersistableState()),
      inspectDataBlock: () => document.getElementById('quire-data'),
    };
    return () => {
      delete (window as any).quireDebug;
    };
  }, [debugPanelOpen]);

  // ─── persistence status subscription ───────────────────────────────────
  useEffect(() => {
    return persistence.subscribe((s) => {
      useWikiStore.getState().setSaveStatus(s);
    });
  }, []);

  // ─── beforeunload guard for tier B ────────────────────────────────────
  useEffect(() => {
    if (saveStatus.tier !== 'B') return;
    return persistence.installBeforeUnloadGuard(
      () => useWikiStore.getState().saveStatus.pendingChanges,
    );
  }, [saveStatus.tier]);

  // ─── nudge every 5 min if dirty ───────────────────────────────────────
  useEffect(() => {
    if (saveStatus.tier !== 'B') return;
    const t = setInterval(() => {
      const s = useWikiStore.getState().saveStatus;
      if (s.pendingChanges > 0) {
        useWikiStore.getState().pushToast({
          message: 'You have unsaved changes. Save your wiki to keep them permanent.',
          ttl: 6000,
          action: {
            label: 'Save',
            run: () => doManualSave(),
          },
        });
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveStatus.tier]);

  // ─── derived ──────────────────────────────────────────────────────────
  const index = useMemo(() => buildIndex(leaves), [leaves]);
  const tags = useMemo(() => tagCounts(leaves), [leaves]);
  const recent = useMemo(
    () => [...leaves].sort((a, b) => (b.edited > a.edited ? 1 : -1)),
    [leaves],
  );
  const todayId = useMemo(() => leaves.find((l) => l.isJournal)?.id ?? null, [leaves]);
  const people = useMemo(() => leafCountsByAuthor(leaves, users), [leaves, users]);
  const getUser = useCallback(
    (id: UserID | null | undefined) => findUser(users, id || null),
    [users],
  );
  const authoredCount = useMemo(
    () =>
      currentUser ? leaves.filter((l) => l.authorId === currentUser.id).length : 0,
    [leaves, currentUser],
  );

  let openLeavesArr = openIds.map((id) => index.byId.get(id)).filter(Boolean) as typeof leaves;
  if (activeFilter?.type === 'tag') {
    openLeavesArr = openLeavesArr.filter((l) => l.tags.includes(activeFilter.value));
  } else if (activeFilter?.type === 'author') {
    openLeavesArr = openLeavesArr.filter((l) => l.authorId === activeFilter.value);
  } else if (activeFilter?.type === 'folder') {
    const target = activeFilter.value;
    const deep = activeFilter.deep;
    const include = new Set<string>([target]);
    if (deep) {
      // include all descendants
      const queue = [target];
      while (queue.length) {
        const cur = queue.shift()!;
        for (const f of store.folders) {
          if (f.parentId === cur && !include.has(f.id)) {
            include.add(f.id);
            queue.push(f.id);
          }
        }
      }
    }
    openLeavesArr = openLeavesArr.filter((l) => l.folderId && include.has(l.folderId));
  }
  const filterTotalCount =
    activeFilter?.type === 'tag'
      ? leaves.filter((l) => l.tags.includes(activeFilter.value)).length
      : activeFilter?.type === 'author'
        ? leaves.filter((l) => l.authorId === activeFilter.value).length
        : activeFilter?.type === 'folder'
          ? (() => {
              const include = new Set<string>([activeFilter.value]);
              if (activeFilter.deep) {
                const queue = [activeFilter.value];
                while (queue.length) {
                  const cur = queue.shift()!;
                  for (const f of store.folders) {
                    if (f.parentId === cur && !include.has(f.id)) {
                      include.add(f.id);
                      queue.push(f.id);
                    }
                  }
                }
              }
              return leaves.filter((l) => l.folderId && include.has(l.folderId)).length;
            })()
          : 0;
  const filterAuthorUser =
    activeFilter?.type === 'author' ? getUser(activeFilter.value) : null;
  const filterFolder =
    activeFilter?.type === 'folder'
      ? store.folders.find((f) => f.id === activeFilter.value) || null
      : null;

  // ─── handlers ─────────────────────────────────────────────────────────
  const onWikilink = useCallback(
    (target: string) => {
      const tgt = index.byTitle.get(target.toLowerCase());
      if (isMobile) {
        // Mobile: linear navigation. Replace the current leaf, push to history.
        const cur = useWikiStore.getState().focusedId;
        if (cur) setNavHistory((h) => [...h, cur]);
        if (tgt) {
          // Close all currently-open leaves except the new target's parent isn't relevant —
          // simpler: replace `openIds` with just the target.
          useWikiStore.setState((s) => ({
            ...s,
            openIds: [tgt.id],
            focusedId: tgt.id,
          }));
        } else {
          store.newLeaf(target);
        }
        return;
      }
      if (tgt) {
        store.openLeaf(tgt.id);
      } else {
        store.newLeaf(target);
      }
    },
    [index, store, isMobile],
  );

  const goBack = useCallback(() => {
    setNavHistory((h) => {
      if (h.length === 0) return h;
      const next = h.slice(0, -1);
      const prev = h[h.length - 1];
      useWikiStore.setState((s) => ({
        ...s,
        openIds: [prev],
        focusedId: prev,
      }));
      return next;
    });
  }, []);

  const onTagClick = useCallback(
    (t: string) => {
      const currentTag =
        activeFilter?.type === 'tag' ? activeFilter.value : null;
      store.setActiveFilter(currentTag === t ? null : { type: 'tag', value: t });
    },
    [activeFilter, store],
  );

  const onAuthorClick = useCallback(
    (id: UserID) => {
      const currentAuthor =
        activeFilter?.type === 'author' ? activeFilter.value : null;
      store.setActiveFilter(currentAuthor === id ? null : { type: 'author', value: id });
    },
    [activeFilter, store],
  );

  const onAuthorFilterFromPalette = useCallback(
    (id: UserID) => {
      store.setActiveFilter({ type: 'author', value: id });
      store.setPaletteOpen(false);
    },
    [store],
  );

  const cycleTheme = () => {
    const next: ThemeName =
      settings.theme === 'paper' ? 'ink' : settings.theme === 'ink' ? 'mono' : 'paper';
    store.setSetting('theme', next);
  };

  const exists = useCallback((title: string) => index.byTitle.has(title.toLowerCase()), [index]);

  // ─── manual save / connect ────────────────────────────────────────────
  const doManualSave = useCallback(async () => {
    const state = useWikiStore.getState().getPersistableState();
    if (saveStatus.tier === 'A') {
      if (!hasFileHandle) {
        try {
          await persistence.connectFile(state.wikiId);
          setHasFileHandle(true);
        } catch (err: any) {
          useWikiStore.getState().pushToast({
            message: 'File picker cancelled. Falling back to download.',
            ttl: 4000,
          });
          await persistence.manualDownload(state, originalFilename);
          return;
        }
      }
      await persistence.save(state);
    } else if (saveStatus.tier === 'B') {
      await persistence.manualDownload(state, originalFilename);
      useWikiStore.getState().pushToast({
        message: 'Downloaded — replace your old quire.html with this file to keep changes permanent.',
        ttl: 6000,
      });
    } else {
      // tier C — only export available
      await persistence.exportJSON(state);
    }
  }, [saveStatus.tier, hasFileHandle, originalFilename]);

  const onConnectFile = useCallback(async () => {
    const state = useWikiStore.getState().getPersistableState();
    try {
      await persistence.connectFile(state.wikiId);
      setHasFileHandle(true);
      await persistence.save(state);
      useWikiStore.getState().setOnboardingDismissed(true);
      useWikiStore.getState().pushToast({
        message: 'Connected. Future changes auto-save silently.',
        ttl: 4000,
      });
    } catch (err) {
      useWikiStore.getState().pushToast({
        message: 'Could not connect file. Manual save remains available.',
        kind: 'error',
        ttl: 5000,
      });
    }
  }, []);

  const onPaletteCommand = useCallback(
    async (cmd: PaletteCommand) => {
      const state = useWikiStore.getState().getPersistableState();
      switch (cmd.kind) {
        case 'theme':
          store.setSetting('theme', cmd.value);
          break;
        case 'layout':
          store.setSetting('layout', cmd.value);
          break;
        case 'save':
          await doManualSave();
          break;
        case 'export-html':
          await persistence.exportSnapshot(state);
          break;
        case 'export-md':
          await persistence.exportMarkdown(state);
          break;
        case 'export-json':
          await persistence.exportJSON(state);
          break;
        case 'settings':
          store.setSettingsOpen(true);
          break;
        case 'tasks':
          setTasksOpen(true);
          setTasksFocused(true);
          break;
      }
    },
    [doManualSave, store],
  );

  // ─── leaf navigation helpers ──────────────────────────────────────────
  const focusAdjacentLeaf = useCallback(
    (dir: -1 | 1) => {
      const ids = openIds;
      if (ids.length === 0) return;
      const i = focusedId ? ids.indexOf(focusedId) : -1;
      const next = i < 0 ? 0 : (i + dir + ids.length) % ids.length;
      store.setFocused(ids[next]);
      setTasksFocused(false);
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-leaf-id="${ids[next]}"]`);
        if (el)
          (el as HTMLElement).scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
          });
      });
    },
    [openIds, focusedId, store],
  );

  // ─── shortcut handler (top-level fallback; modals register first) ─────
  const handleShortcut = useCallback(
    (action: ShortcutAction): boolean => {
      switch (action) {
        case 'palette.open':
          store.setPaletteOpen(!paletteOpen);
          if (!paletteOpen) store.setPaletteQuery('');
          return true;
        case 'leaf.new':
          store.newLeaf('');
          return true;
        case 'leaf.toggleEdit':
          if (focusedId) {
            store.setEditing(editingId === focusedId ? null : focusedId);
            return true;
          }
          return false;
        case 'leaf.close':
          if (focusedId) {
            store.closeLeaf(focusedId);
            return true;
          }
          return false;
        case 'leaf.moveLeft':
          if (focusedId) {
            store.moveLeaf(focusedId, -1);
            return true;
          }
          return false;
        case 'leaf.moveRight':
          if (focusedId) {
            store.moveLeaf(focusedId, 1);
            return true;
          }
          return false;
        case 'leaf.focusNext':
          focusAdjacentLeaf(1);
          return true;
        case 'leaf.focusPrev':
          focusAdjacentLeaf(-1);
          return true;
        case 'wiki.save':
          doManualSave();
          return true;
        case 'settings.toggle':
          store.setSettingsOpen(!settingsOpen);
          return true;
        case 'tasks.toggle':
          setTasksOpen((prev) => {
            const next = !prev;
            if (next) setTasksFocused(true);
            return next;
          });
          return true;
        case 'help.show':
          setHelpOpen(true);
          return true;
        case 'lock.now':
          doLockNow();
          return true;
        case 'esc':
          // Modals register their own handlers ahead of this one.
          return false;
      }
    },
    [
      paletteOpen,
      settingsOpen,
      focusedId,
      editingId,
      store,
      doManualSave,
      focusAdjacentLeaf,
    ],
  );
  useShortcuts(handleShortcut);

  // ─── drag handlers (river reorder) ────────────────────────────────────
  const draggingId = store.draggingId;
  const dragHandlers = (id: string) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      store.setDraggingId(id);
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragOver: (e: DragEvent) => {
      if (draggingId && draggingId !== id) e.preventDefault();
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      if (!draggingId || draggingId === id) return;
      store.reorderOpen(draggingId, id);
      store.setDraggingId(null);
    },
    onDragEnd: () => store.setDraggingId(null),
  });

  // ─── style vars ───────────────────────────────────────────────────────
  const theme = THEMES[settings.theme] || THEMES.paper;
  const fonts = FONT_PAIRS[settings.fontPair] || FONT_PAIRS.editorial;
  const accent = ACCENTS[settings.accent] || ACCENTS.ochre;
  const dens =
    settings.density === 'compact'
      ? { pad: 18, w: 380, gap: 14, leading: 1.55 }
      : settings.density === 'comfy'
        ? { pad: 32, w: 540, gap: 24, leading: 1.78 }
        : { pad: 24, w: 460, gap: 18, leading: 1.65 };

  const cssVars: React.CSSProperties = {
    ...theme,
    '--q-accent': accent,
    '--q-font-head': fonts.head,
    '--q-font-body': fonts.body,
    '--q-font-mono': fonts.mono,
    '--q-pad': dens.pad + 'px',
    '--q-leaf-w': dens.w + 'px',
    '--q-gap': dens.gap + 'px',
    '--q-leading': String(dens.leading),
  } as React.CSSProperties;

  // file size estimate
  useEffect(() => {
    if (!hydrated) return;
    try {
      const html = persistence.buildHTML(useWikiStore.getState().getPersistableState());
      setFileSize(html.length);
      if (html.length > 10 * 1024 * 1024) {
        useWikiStore.getState().pushToast({
          message: 'Your wiki is over 10 MB. Saves may be slow on this file size.',
          ttl: 6000,
        });
      }
    } catch {
      // ignore
    }
  }, [leaves, openIds, settings, hydrated]);

  const showOnboarding =
    saveStatus.tier === 'A' && !hasFileHandle && !onboardingDismissed && hydrated;

  const fileSizeText = `${originalFilename} · ${formatBytes(fileSize)}`;
  const savedText = saveStatus.lastSaved ? `${formatRel(saveStatus.lastSaved)}, locally` : 'never';
  const showBacklinksUI = settings.backlinks && !!settings.plugins.backlinks;

  return (
    <div
      className={
        `q-app q-theme-${settings.theme} q-layout-${settings.layout}` +
        (settings.sidebar ? '' : ' q-no-side')
      }
      style={cssVars}
    >
      {saveStatus.tier === 'C' && (
        <div className="q-banner">
          This browser blocks file access. Notes save in this browser only — export to JSON
          regularly to back up.
        </div>
      )}

      <TopBar
        onCmd={() => {
          store.setPaletteOpen(true);
          store.setPaletteQuery('');
        }}
        onNew={() => store.newLeaf('')}
        onToggleTheme={cycleTheme}
        theme={settings.theme}
        onToggleSidebar={() => store.setSetting('sidebar', !settings.sidebar)}
        onOpenSettings={() => store.setSettingsOpen(true)}
        onStatusClick={() => {
          if (saveStatus.state === 'error' || saveStatus.state === 'dirty') {
            doManualSave();
          } else {
            store.setSettingsOpen(true);
          }
        }}
        sidebarOpen={settings.sidebar}
        count={leaves.length}
        query={
          activeFilter?.type === 'tag'
            ? `filtered: #${activeFilter.value}`
            : activeFilter?.type === 'author'
              ? `filtered: @${filterAuthorUser?.name || ''}`
              : activeFilter?.type === 'folder'
                ? `filtered: 📁 ${filterFolder?.name || ''}`
                : ''
        }
        saveStatus={saveStatus}
        protectionMode={protection.mode}
        onLockNow={doLockNow}
        onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        onBack={isMobile && navHistory.length > 0 ? goBack : null}
      />

      <div className="q-shell">
        {(() => {
          // On mobile: render the sidebar inside a slide-in drawer regardless
          // of `settings.sidebar` (which controls desktop visibility).
          // On desktop / tablet: render inline iff `settings.sidebar` is true.
          const sidebarEl = (
            <Sidebar
              leaves={leaves}
              openIds={openIds}
              focusedId={focusedId}
              onOpen={(id) => {
                if (isMobile) {
                  // Replace open leaves with just the target; close drawer.
                  const cur = useWikiStore.getState().focusedId;
                  if (cur && cur !== id) setNavHistory((h) => [...h, cur]);
                  useWikiStore.setState((s) => ({
                    ...s,
                    openIds: [id],
                    focusedId: id,
                  }));
                  setMobileSidebarOpen(false);
                } else {
                  store.openLeaf(id);
                }
              }}
              onJumpToday={() => {
                if (todayId) {
                  if (isMobile) {
                    useWikiStore.setState((s) => ({
                      ...s,
                      openIds: [todayId],
                      focusedId: todayId,
                    }));
                    setMobileSidebarOpen(false);
                  } else {
                    store.openLeaf(todayId);
                  }
                }
              }}
              todayId={todayId}
              tags={tags}
              activeFilter={activeFilter}
              onTagClick={(t) => {
                onTagClick(t);
                if (isMobile) setMobileSidebarOpen(false);
              }}
              onAuthorClick={(id) => {
                onAuthorClick(id);
                if (isMobile) setMobileSidebarOpen(false);
              }}
              recent={recent}
              fileSizeText={fileSizeText}
              savedText={savedText}
              people={people}
              currentUserId={currentUserId}
              onOpenTasks={() => {
                setTasksOpen(true);
                setTasksFocused(true);
                if (isMobile) setMobileSidebarOpen(false);
              }}
              showOverdueBadge={settings.tasks.showOverdueBadge}
              folders={store.folders}
              showLeafCounts={true}
              onFolderFilter={(fid, deep) => {
                onFolderFilterClick(fid, deep);
                if (isMobile) setMobileSidebarOpen(false);
              }}
              onFolderCreate={(parentId) => {
                const name = window.prompt('New folder name', 'Folder');
                if (!name) return;
                store.createFolder(name.trim() || 'Folder', parentId);
              }}
              onFolderContextMenu={(folder, pos) =>
                folderMenu.open(folder, pos)
              }
            />
          );
          if (isMobile) {
            return (
              <SidebarDrawer
                open={mobileSidebarOpen}
                onClose={() => setMobileSidebarOpen(false)}
              >
                {sidebarEl}
              </SidebarDrawer>
            );
          }
          return settings.sidebar ? sidebarEl : null;
        })()}

        <main className="q-main">
          {activeFilter && (
            <div className="q-filter-bar">
              {activeFilter.type === 'tag' ? (
                <span>
                  Showing leaves tagged <b>#{activeFilter.value}</b> · {openLeavesArr.length} open ·{' '}
                  {filterTotalCount} total
                </span>
              ) : activeFilter.type === 'folder' ? (
                <span>
                  Showing leaves in <b>📁 {filterFolder?.name || 'unknown'}</b> ·{' '}
                  {openLeavesArr.length} open · {filterTotalCount} total{' '}
                  <label style={{ marginLeft: 12, fontSize: 11 }}>
                    <input
                      type="checkbox"
                      checked={activeFilter.deep}
                      onChange={(e) =>
                        store.setActiveFilter({
                          type: 'folder',
                          value: activeFilter.value,
                          deep: e.target.checked,
                        })
                      }
                    />{' '}
                    Include sub-folders
                  </label>
                </span>
              ) : (
                <span>
                  {filterAuthorUser && (
                    <AuthorChip
                      user={filterAuthorUser}
                      title={filterAuthorUser.name}
                    />
                  )}
                  <span className="q-filter-author-chip" />
                  Showing leaves by <b>{filterAuthorUser?.name || 'unknown'}</b> ·{' '}
                  {openLeavesArr.length} open · {filterTotalCount} total
                </span>
              )}
              <button onClick={() => store.setActiveFilter(null)}>clear filter</button>
            </div>
          )}

          <div className={`q-river q-river-${settings.layout}`}>
            {folderUnlockTarget && (() => {
              const f = store.folders.find((x) => x.id === folderUnlockTarget);
              if (!f) return null;
              return (
                <FolderUnlockCard
                  folder={f}
                  folders={store.folders}
                  leaves={leaves}
                  onUnlock={handleFolderUnlock}
                  onCancel={() => setFolderUnlockTarget(null)}
                />
              );
            })()}
            {tasksOpen && (
              <TasksView
                focused={tasksFocused}
                leafIndex={0}
                onClose={() => {
                  setTasksOpen(false);
                  setTasksFocused(false);
                }}
                onOpenLeaf={(id) => {
                  setTasksFocused(false);
                  store.openLeaf(id);
                }}
                onWikilink={onWikilink}
                onTag={onTagClick}
                exists={exists}
                getUser={getUser}
                dateFormat={settings.tasks.dateFormat}
                spineNumbers={settings.spineNumbers}
              />
            )}
            {openLeavesArr.length === 0 && !tasksOpen && (
              <div className="q-empty">
                <div className="q-empty-mark" />
                <h3>
                  {activeFilter?.type === 'author'
                    ? `No leaves by ${filterAuthorUser?.name || 'this user'} yet.`
                    : 'The river is dry.'}
                </h3>
                <p>
                  Press <kbd>⌘K</kbd> to find a leaf, or <kbd>⌘N</kbd> to write a new one.
                </p>
              </div>
            )}
            {openLeavesArr.map((leaf, idx) => (
              <LeafCard
                key={leaf.id}
                leaf={leaf}
                leafIndex={idx}
                focused={focusedId === leaf.id}
                isJournal={leaf.isJournal}
                editing={editingId === leaf.id}
                showBacklinks={showBacklinksUI}
                spineNumbers={settings.spineNumbers}
                backlinks={index.back.get(leaf.id) || []}
                exists={exists}
                onFocus={() => {
                  store.setFocused(leaf.id);
                  setTasksFocused(false);
                }}
                onClose={() => store.closeLeaf(leaf.id)}
                onWikilink={onWikilink}
                onTag={onTagClick}
                onAuthorClick={onAuthorClick}
                getUser={getUser}
                showAttribution={settings.showAuthorAttribution}
                onChange={(next) => store.updateLeaf(next)}
                onChangeBody={(id, plaintext) => store.updateLeafBody(id, plaintext)}
                onToggleEdit={() =>
                  store.setEditing(editingId === leaf.id ? null : leaf.id)
                }
                onTogglePin={() => store.togglePin(leaf.id)}
                dateFormat={settings.tasks.dateFormat}
                folders={store.folders}
                onFolderClick={(fid) => onFolderFilterClick(fid, true)}
                dragHandlers={dragHandlers(leaf.id)}
              />
            ))}
            <div className="q-river-end" />
          </div>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        query={paletteQuery}
        setQuery={(q) => store.setPaletteQuery(q)}
        onClose={() => store.setPaletteOpen(false)}
        leaves={leaves}
        users={users}
        onOpenLeaf={(id) => store.openLeaf(id)}
        onNew={(t) => store.newLeaf(t)}
        onCommand={onPaletteCommand}
        onAuthorFilter={onAuthorFilterFromPalette}
        folders={store.folders}
        onFolderFilter={(fid) => {
          onFolderFilterClick(fid, true);
          store.setPaletteOpen(false);
        }}
      />

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => store.setSettingsOpen(false)}
        settings={settings}
        setSetting={(k, v) => store.setSetting(k, v)}
        togglePlugin={(id) => store.togglePlugin(id)}
        onSave={() => doManualSave()}
        onExportSnapshot={() =>
          persistence.exportSnapshot(useWikiStore.getState().getPersistableState())
        }
        onExportMarkdown={() =>
          persistence.exportMarkdown(useWikiStore.getState().getPersistableState())
        }
        onExportJSON={() => openExportDialog()}
        onImportJSON={() => {
          setImportInitialFile(null);
          setImportDialogOpen(true);
          store.setSettingsOpen(false);
        }}
        onConnectFile={onConnectFile}
        fileSizeText={fileSizeText}
        lastSaved={saveStatus.lastSaved}
        tier={saveStatus.tier}
        hasFileHandle={hasFileHandle}
        currentUser={currentUser}
        users={users}
        authoredCount={authoredCount}
        onUpdateUser={(id, patch) => store.updateUser(id, patch)}
        onSetCurrentUserId={(id) => {
          store.setCurrentUser(id);
          void persistence.setCurrentUserId(store.wikiId, id);
        }}
        onAddUser={(u) => store.addUser(u)}
        onBackfillAttribution={() => store.backfillAttributionToCurrentUser()}
        unattributedLeafCount={
          leaves.filter(
            (l) =>
              !l.authorId || l.authorId === 'legacy',
          ).length
        }
        onShowShortcuts={() => {
          store.setSettingsOpen(false);
          setHelpOpen(true);
        }}
        debugPanelOpen={debugPanelOpen}
        onSetDebugPanelOpen={(v) => {
          setDebugPanelOpen(v);
          void persistence.setMeta('debug:enabled', v);
        }}
        onShowIntroCardAgain={() => {
          void persistence.setMeta(
            `welcome:${useWikiStore.getState().wikiId}`,
            { dismissed: false },
          );
          setIntroCardVariant(
            useWikiStore.getState().leaves.length > 0 ? 'seeded' : 'empty',
          );
          store.setSettingsOpen(false);
        }}
        protection={protection}
        autolock={autolock}
        filename={lockState.filename}
        onSetAutolock={(a) => store.setAutolock(a)}
        onSetProtection={(p) => store.setProtection(p)}
        onLockNow={doLockNow}
        onEnablePassword={onEnablePassword}
        onChangePassword={onChangePassword}
        onDisablePassword={onDisablePassword}
        folders={store.folders}
        onChangeFolderPassword={(f) =>
          setFolderChangePwdTarget({ folderId: f.id, variant: 'change' })
        }
        onDisableFolderProtection={(f) =>
          setFolderChangePwdTarget({ folderId: f.id, variant: 'disable' })
        }
      />

      {/* Password setup */}
      <PasswordSetupDialog
        open={setupOpen}
        leafCount={leaves.length}
        filename={lockState.filename}
        lastSaved={saveStatus.lastSaved}
        onCancel={() => setSetupOpen(false)}
        onCommit={commitSetup}
        onExportJSON={() =>
          persistence.exportJSON(useWikiStore.getState().getPersistableState())
        }
      />
      <ChangePasswordDialog
        open={!!changePwdOpen}
        variant={changePwdOpen === 'disable' ? 'disable' : 'change'}
        onCancel={() => setChangePwdOpen(null)}
        onVerifyCurrent={verifyCurrentPwd}
        onCommit={commitChangePassword}
      />

      {/* Folder dialogs */}
      <FolderContextMenu
        folder={folderMenu.menu.folder}
        position={folderMenu.menu.position}
        onClose={folderMenu.close}
        actions={folderActions}
      />
      <FolderEncryptDialog
        open={!!folderEncryptTarget}
        folder={
          store.folders.find((f) => f.id === folderEncryptTarget) || null
        }
        leafCount={
          folderEncryptTarget
            ? leavesInFolderHelper(
                store.leaves,
                store.folders,
                folderEncryptTarget,
                true,
              ).length
            : 0
        }
        onCancel={() => setFolderEncryptTarget(null)}
        onCommit={commitFolderEncrypt}
        onExportFolder={(_f) =>
          persistence.exportJSON(useWikiStore.getState().getPersistableState())
        }
      />
      <FolderChangePasswordDialog
        open={!!folderChangePwdTarget}
        folder={
          folderChangePwdTarget
            ? store.folders.find((f) => f.id === folderChangePwdTarget.folderId) ||
              null
            : null
        }
        variant={folderChangePwdTarget?.variant || 'change'}
        onCancel={() => setFolderChangePwdTarget(null)}
        onVerifyCurrent={verifyFolderPwdAdapter}
        onCommit={commitFolderChangePassword}
      />

      {/* Lock overlay — rendered above everything when locked */}
      {lockState.locked && (
        <LockOverlay
          mode={protection.mode}
          protection={protection}
          filename={lockState.filename}
          lastSaved={saveStatus.lastSaved}
          failedAttempts={lockState.failedAttempts}
          cooldownUntil={lockState.cooldownUntil}
          onCurtainDismiss={onCurtainDismiss}
          onPasswordSubmit={onUnlockPassword}
        />
      )}

      {showOnboarding && (
        <div className="q-onboard">
          <div className="q-onboard-title">Connect this app to your file</div>
          <div className="q-onboard-body">
            Pick where to save your Quire wiki. After that, every change auto-saves silently —
            no downloads, no prompts.
          </div>
          <div className="q-onboard-actions">
            <button
              className="q-onboard-skip"
              onClick={() => store.setOnboardingDismissed(true)}
            >
              Skip for now
            </button>
            <button className="q-btn-primary" onClick={onConnectFile}>
              <Icon name="download" size={11} /> Connect file
            </button>
          </div>
        </div>
      )}

      {restore?.open && (
        <div className="q-modal-scrim">
          <div className="q-modal">
            <div className="q-modal-title">Unsaved changes found</div>
            <div className="q-modal-body">
              You have edits from{' '}
              <b>{restore.draftLastSaved ? formatRel(restore.draftLastSaved) : 'earlier'}</b>{' '}
              that weren't saved to the file. Restore them?
            </div>
            <div className="q-modal-actions">
              <button className="q-onboard-skip" onClick={restore.onDiscard}>
                Discard
              </button>
              <button className="q-btn-primary" onClick={restore.onRestore}>
                Restore draft
              </button>
            </div>
          </div>
        </div>
      )}

      <ShortcutHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />

      <IntroCard
        open={introCardVariant !== null}
        variant={introCardVariant || 'seeded'}
        onDismiss={() => {
          if (introCardVariant !== null) {
            void persistence.setMeta(`welcome:${useWikiStore.getState().wikiId}`, {
              dismissed: true,
              dismissedAt: new Date().toISOString(),
            });
          }
          setIntroCardVariant(null);
        }}
        onImport={() => {
          setImportInitialFile(null);
          setImportDialogOpen(true);
          // Keep the card visible behind the import dialog so the user can
          // cancel and still see it.
        }}
        onCreateNote={() => {
          store.newLeaf('');
        }}
      />

      <DebugPanel
        open={debugPanelOpen}
        onClose={() => {
          setDebugPanelOpen(false);
          void persistence.setMeta('debug:enabled', false);
        }}
      />

      <ImportDialog
        open={importDialogOpen}
        currentState={useWikiStore.getState().getPersistableState()}
        initialFile={importInitialFile}
        onCancel={() => {
          setImportDialogOpen(false);
          setImportInitialFile(null);
        }}
        onApply={onApplyImport}
      />

      <ExportJSONDialog
        open={exportDialogOpen}
        stats={exportStats}
        onCancel={() => setExportDialogOpen(false)}
        onConfirm={confirmExport}
      />

      {dropOverlayActive && (
        <div className="q-drop-overlay" aria-hidden="true">
          <div className="q-drop-overlay-card">
            <div style={{ fontSize: 56 }}>📥</div>
            <div className="q-drop-overlay-title">Drop a Quire JSON file here</div>
            <div className="q-drop-overlay-sub">to import its content</div>
          </div>
        </div>
      )}

      <ToastStack toasts={toasts} onDismiss={(id) => store.dismissToast(id)} />

      {remoteUpdateAvailable && (
        <div className="q-toast-stack" style={{ bottom: 'auto', top: 70 }}>
          <div className="q-toast">
            <div className="q-toast-msg">This file was updated in another tab.</div>
            <button
              className="q-toast-action"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
