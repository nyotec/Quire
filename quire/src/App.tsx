import { useCallback, useEffect, useMemo, useState, DragEvent } from 'react';
import { useWikiStore } from './store/useWikiStore';
import { persistence } from './store/persistence';
import { welcomeLeaf } from './seed/welcome';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { LeafCard } from './components/LeafCard';
import { CommandPalette, PaletteCommand } from './components/CommandPalette';
import { SettingsDrawer } from './components/SettingsDrawer';
import { ToastStack } from './components/Toast';
import { Icon } from './components/Icon';
import { buildIndex, tagCounts } from './lib/wikilinks';
import { formatBytes, formatRel, uuid } from './lib/utils';
import { useGlobalHotkeys } from './lib/hotkeys';
import type { AccentName, FontPair, ThemeName } from './types';
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
    activeTag,
    paletteOpen,
    paletteQuery,
    editingId,
    settingsOpen,
    toasts,
    onboardingDismissed,
    saveStatus,
    remoteUpdateAvailable,
  } = store;

  const [hydrated, setHydrated] = useState(false);
  const [restore, setRestore] = useState<RestorePromptState | null>(null);
  const [hasFileHandle, setHasFileHandle] = useState(false);
  const [originalFilename] = useState<string>('quire.html');
  const [fileSize, setFileSize] = useState<number>(0);

  // ─── boot sequence ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tier = persistence.detectTier();
      const fromHTML = persistence.loadFromHTML();
      let baseState =
        fromHTML ?? {
          schemaVersion: 1 as const,
          wikiId: uuid(),
          leaves: [welcomeLeaf()],
          openIds: ['welcome'],
          focusedId: 'welcome',
          settings: DEFAULT_SETTINGS,
          lastSaved: new Date().toISOString(),
        };

      const draft = await persistence.loadDraftFromIDB(baseState.wikiId);
      const useDraft =
        draft && draft.lastSaved && baseState.lastSaved && draft.lastSaved > baseState.lastSaved;

      const finish = (chosen: typeof baseState) => {
        if (cancelled) return;
        store.hydrate(chosen);
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
  let openLeavesArr = openIds.map((id) => index.byId.get(id)).filter(Boolean) as typeof leaves;
  if (activeTag) openLeavesArr = openLeavesArr.filter((l) => l.tags.includes(activeTag));

  // ─── handlers ─────────────────────────────────────────────────────────
  const onWikilink = useCallback(
    (target: string) => {
      const tgt = index.byTitle.get(target.toLowerCase());
      if (tgt) {
        store.openLeaf(tgt.id);
      } else {
        store.newLeaf(target);
      }
    },
    [index, store],
  );

  const onTagClick = useCallback(
    (t: string) => {
      store.setActiveTag(activeTag === t ? null : t);
    },
    [activeTag, store],
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
      }
    },
    [doManualSave, store],
  );

  // ─── hotkeys ──────────────────────────────────────────────────────────
  useGlobalHotkeys(
    useCallback(
      (e: KeyboardEvent) => {
        const meta = e.metaKey || e.ctrlKey;
        if (meta && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          store.setPaletteOpen(true);
          store.setPaletteQuery('');
        } else if (meta && e.key.toLowerCase() === 'n') {
          e.preventDefault();
          store.newLeaf('');
        } else if (meta && e.key.toLowerCase() === 'e' && focusedId) {
          e.preventDefault();
          store.setEditing(editingId === focusedId ? null : focusedId);
        } else if (meta && e.key.toLowerCase() === 'w' && focusedId) {
          e.preventDefault();
          store.closeLeaf(focusedId);
        } else if (meta && e.key === '[' && focusedId) {
          e.preventDefault();
          store.moveLeaf(focusedId, -1);
        } else if (meta && e.key === ']' && focusedId) {
          e.preventDefault();
          store.moveLeaf(focusedId, 1);
        } else if (meta && e.key.toLowerCase() === 's') {
          e.preventDefault();
          doManualSave();
        } else if (meta && e.key === ',') {
          e.preventDefault();
          store.setSettingsOpen(true);
        } else if (e.key === 'Escape') {
          if (paletteOpen) store.setPaletteOpen(false);
          if (settingsOpen) store.setSettingsOpen(false);
        }
      },
      [focusedId, editingId, paletteOpen, settingsOpen, store, doManualSave],
    ),
  );

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
        query={activeTag ? `filtered: #${activeTag}` : ''}
        saveStatus={saveStatus}
      />

      <div className="q-shell">
        {settings.sidebar && (
          <Sidebar
            leaves={leaves}
            openIds={openIds}
            focusedId={focusedId}
            onOpen={(id) => store.openLeaf(id)}
            onJumpToday={() => todayId && store.openLeaf(todayId)}
            todayId={todayId}
            tags={tags}
            activeTag={activeTag}
            onTagClick={onTagClick}
            recent={recent}
            fileSizeText={fileSizeText}
            savedText={savedText}
          />
        )}

        <main className="q-main">
          {activeTag && (
            <div className="q-filter-bar">
              <span>
                Showing leaves tagged <b>#{activeTag}</b> · {openLeavesArr.length} open ·{' '}
                {leaves.filter((l) => l.tags.includes(activeTag)).length} total
              </span>
              <button onClick={() => store.setActiveTag(null)}>clear filter</button>
            </div>
          )}

          <div className={`q-river q-river-${settings.layout}`}>
            {openLeavesArr.length === 0 && (
              <div className="q-empty">
                <div className="q-empty-mark" />
                <h3>The river is dry.</h3>
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
                onFocus={() => store.setFocused(leaf.id)}
                onClose={() => store.closeLeaf(leaf.id)}
                onWikilink={onWikilink}
                onTag={onTagClick}
                onChange={(next) => store.updateLeaf(next)}
                onToggleEdit={() =>
                  store.setEditing(editingId === leaf.id ? null : leaf.id)
                }
                onTogglePin={() => store.togglePin(leaf.id)}
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
        onOpenLeaf={(id) => store.openLeaf(id)}
        onNew={(t) => store.newLeaf(t)}
        onCommand={onPaletteCommand}
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
      />

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
