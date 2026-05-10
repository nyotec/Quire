import { useCallback, useEffect, useMemo, useState, DragEvent } from 'react';
import { useCurrentUser, useWikiStore } from './store/useWikiStore';
import { persistence } from './store/persistence';
import { welcomeLeaf } from './seed/welcome';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { LeafCard } from './components/LeafCard';
import { CommandPalette, PaletteCommand } from './components/CommandPalette';
import { SettingsDrawer } from './components/SettingsDrawer';
import { ToastStack } from './components/Toast';
import { Icon } from './components/Icon';
import { UserOnboardingModal } from './components/UserOnboardingModal';
import { AuthorChip } from './components/AuthorChip';
import { TasksView } from './components/TasksView';
import { ShortcutHelpDialog } from './components/ShortcutHelpDialog';
import { LockOverlay } from './components/LockOverlay';
import { PasswordSetupDialog } from './components/PasswordSetupDialog';
import { ChangePasswordDialog } from './components/ChangePasswordDialog';
import { SidebarDrawer } from './components/SidebarDrawer';
import { useIsMobile } from './lib/useMediaQuery';
import { buildIndex, tagCounts } from './lib/wikilinks';
import { formatBytes, formatRel, uuid } from './lib/utils';
import { ShortcutAction, setShortcutsSuppressed, useShortcuts } from './lib/hotkeys';
import { findUser, leafCountsByAuthor, makeUser, migrateToV2 } from './lib/users';
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
    needsIdentity,
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

  // ─── boot sequence ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tier = persistence.detectTier();
      const fromHTML = persistence.loadFromHTML();
      let baseState: WikiState =
        fromHTML ??
        migrateToV3(
          migrateToV2({
            schemaVersion: 1,
            wikiId: uuid(),
            leaves: [welcomeLeaf()],
            openIds: ['welcome'],
            focusedId: 'welcome',
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

      const finish = async (chosen: WikiState) => {
        if (cancelled) return;
        // Resolve current user identity for this browser.
        let savedId = await persistence.getCurrentUserId(chosen.wikiId);
        const userExists =
          savedId && chosen.users && chosen.users.some((u) => u.id === savedId);
        if (!userExists) savedId = null;
        store.hydrate(chosen, savedId);
        if (!savedId) {
          useWikiStore.getState().setNeedsIdentity(true);
        }
        const seenHint = await persistence.getMeta<boolean>('hint:shortcuts');
        setShortcutHintShown(!!seenHint);
        setBaselineLeafCount(chosen.leaves.length);
        setHydrated(true);
      };

      if (useDraft) {
        setRestore({
          open: true,
          draftLastSaved: draft!.lastSaved,
          onRestore: () => {
            finish(draft!);
            setRestore(null);
          },
          onDiscard: () => {
            persistence.clearDraftFromIDB(baseState.wikiId);
            finish(baseState);
            setRestore(null);
          },
        });
      } else {
        finish(baseState);
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
  }
  const filterTotalCount =
    activeFilter?.type === 'tag'
      ? leaves.filter((l) => l.tags.includes(activeFilter.value)).length
      : activeFilter?.type === 'author'
        ? leaves.filter((l) => l.authorId === activeFilter.value).length
        : 0;
  const filterAuthorUser =
    activeFilter?.type === 'author' ? getUser(activeFilter.value) : null;

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
                onChange={(next) => store.updateLeaf(next)}
                onChangeBody={(id, plaintext) => store.updateLeafBody(id, plaintext)}
                onToggleEdit={() =>
                  store.setEditing(editingId === leaf.id ? null : leaf.id)
                }
                onTogglePin={() => store.togglePin(leaf.id)}
                dateFormat={settings.tasks.dateFormat}
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
        onExportJSON={() =>
          persistence.exportJSON(useWikiStore.getState().getPersistableState())
        }
        onConnectFile={onConnectFile}
        fileSizeText={fileSizeText}
        lastSaved={saveStatus.lastSaved}
        tier={saveStatus.tier}
        hasFileHandle={hasFileHandle}
        currentUser={currentUser}
        users={users}
        authoredCount={authoredCount}
        onUpdateUser={(id, patch) => store.updateUser(id, patch)}
        onShowShortcuts={() => {
          store.setSettingsOpen(false);
          setHelpOpen(true);
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

      <UserOnboardingModal
        open={hydrated && needsIdentity}
        onSubmit={(name, initials) => {
          const u = makeUser(name, initials, useWikiStore.getState().users);
          store.addUser(u);
          store.setCurrentUser(u.id);
          store.setNeedsIdentity(false);
          persistence.setCurrentUserId(useWikiStore.getState().wikiId, u.id);
          useWikiStore.getState().pushToast({
            message: `Welcome, ${u.name}. Your notes will be marked with ${u.initials}.`,
            ttl: 5000,
          });
        }}
      />

      <ShortcutHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />

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
