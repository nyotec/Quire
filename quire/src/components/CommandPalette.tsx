import { useEffect, useMemo, useRef, useState } from 'react';
import type { Leaf, LeafID } from '../types';
import { Icon } from './Icon';
import { formatRel } from '../lib/utils';
import { makeFuse } from '../lib/search';

type CmdMode = 'cmd' | 'tag' | 'body' | 'find';

interface CmdResult {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

export type PaletteCommand =
  | { kind: 'theme'; value: 'paper' | 'ink' | 'mono' }
  | { kind: 'layout'; value: 'river' | 'stack' }
  | { kind: 'save' }
  | { kind: 'export-html' }
  | { kind: 'export-md' }
  | { kind: 'export-json' }
  | { kind: 'settings' };

interface PaletteProps {
  open: boolean;
  query: string;
  setQuery: (q: string) => void;
  onClose: () => void;
  leaves: Leaf[];
  onOpenLeaf: (id: LeafID) => void;
  onNew: (title?: string) => void;
  onCommand: (cmd: PaletteCommand) => void;
}

export function CommandPalette({
  open,
  query,
  setQuery,
  onClose,
  leaves,
  onOpenLeaf,
  onNew,
  onCommand,
}: PaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sel, setSel] = useState(0);

  const fuse = useMemo(() => makeFuse(leaves), [leaves]);

  useEffect(() => {
    if (open) {
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const mode: CmdMode = query.startsWith('>')
    ? 'cmd'
    : query.startsWith('#')
      ? 'tag'
      : query.startsWith('/')
        ? 'body'
        : 'find';

  const results: CmdResult[] = useMemo(() => {
    const q = query.replace(/^[>#/]/, '').trim().toLowerCase();
    if (mode === 'cmd') {
      const cmds: CmdResult[] = [
        { id: 'cmd:new', label: 'New leaf', hint: '⌘N', run: () => onNew() },
        { id: 'cmd:save', label: 'Save Wiki', hint: '⌘S', run: () => onCommand({ kind: 'save' }) },
        { id: 'cmd:settings', label: 'Open settings', hint: '⌘,', run: () => onCommand({ kind: 'settings' }) },
        { id: 'cmd:theme:paper', label: 'Theme: Paper', hint: 'set', run: () => onCommand({ kind: 'theme', value: 'paper' }) },
        { id: 'cmd:theme:ink', label: 'Theme: Ink', hint: 'set', run: () => onCommand({ kind: 'theme', value: 'ink' }) },
        { id: 'cmd:theme:mono', label: 'Theme: Mono', hint: 'set', run: () => onCommand({ kind: 'theme', value: 'mono' }) },
        { id: 'cmd:layout:river', label: 'Layout: River', hint: 'set', run: () => onCommand({ kind: 'layout', value: 'river' }) },
        { id: 'cmd:layout:stack', label: 'Layout: Stack', hint: 'set', run: () => onCommand({ kind: 'layout', value: 'stack' }) },
        { id: 'cmd:export-html', label: 'Export snapshot HTML', hint: 'download', run: () => onCommand({ kind: 'export-html' }) },
        { id: 'cmd:export-md', label: 'Export markdown ZIP', hint: 'download', run: () => onCommand({ kind: 'export-md' }) },
        { id: 'cmd:export-json', label: 'Export JSON', hint: 'download', run: () => onCommand({ kind: 'export-json' }) },
      ];
      return cmds.filter((c) => !q || c.label.toLowerCase().includes(q));
    }
    if (mode === 'tag') {
      return leaves
        .filter((l) => l.tags.some((t) => t.toLowerCase().includes(q)))
        .slice(0, 12)
        .map<CmdResult>((l) => ({
          id: l.id,
          label: l.title,
          hint: l.tags
            .filter((t) => t.toLowerCase().includes(q))
            .map((t) => '#' + t)
            .join(' '),
          run: () => onOpenLeaf(l.id),
        }));
    }
    if (mode === 'body') {
      if (!q) return [];
      return leaves
        .map<CmdResult | null>((l) => {
          const idx = l.body.toLowerCase().indexOf(q);
          if (idx < 0) return null;
          const snip = l.body.slice(Math.max(0, idx - 20), idx + 60).replace(/\n/g, ' ');
          return { id: l.id, label: l.title, hint: '…' + snip + '…', run: () => onOpenLeaf(l.id) };
        })
        .filter((x): x is CmdResult => !!x)
        .slice(0, 12);
    }
    // fuzzy find by title
    if (!q) {
      return leaves.slice(0, 8).map<CmdResult>((l) => ({
        id: l.id,
        label: l.title,
        hint: formatRel(l.edited),
        run: () => onOpenLeaf(l.id),
      }));
    }
    const hits = fuse.search(q, { limit: 12 });
    return hits.map<CmdResult>(({ item }) => ({
      id: item.id,
      label: item.title,
      hint: item.tags.slice(0, 2).map((t) => '#' + t).join(' '),
      run: () => onOpenLeaf(item.id),
    }));
  }, [query, mode, leaves, fuse, onOpenLeaf, onNew, onCommand]);

  useEffect(() => {
    setSel((s) => Math.min(s, Math.max(0, results.length - 1)));
  }, [results.length]);

  if (!open) return null;

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(results.length - 1, s + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[sel]) {
        results[sel].run();
        onClose();
      } else if (query.trim()) {
        onNew(query.replace(/^[>#/]/, '').trim());
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="q-palette-scrim" onClick={onClose}>
      <div className="q-palette" onClick={(e) => e.stopPropagation()}>
        <div className="q-palette-row">
          <Icon name={mode === 'cmd' ? 'cmd' : mode === 'tag' ? 'tag' : 'search'} />
          <input
            ref={inputRef}
            className="q-palette-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Type to find · > command · # tag · / search bodies"
          />
          <span className="q-palette-mode">{mode}</span>
        </div>
        <div className="q-palette-list">
          {results.map((r, i) => (
            <div
              key={r.id}
              className={'q-palette-item' + (i === sel ? ' sel' : '')}
              onMouseEnter={() => setSel(i)}
              onClick={() => {
                r.run();
                onClose();
              }}
            >
              <span className="q-palette-label">{r.label}</span>
              <span className="q-palette-hint">{r.hint}</span>
            </div>
          ))}
          {results.length === 0 && (
            <div className="q-palette-empty">
              <span>No matches.</span>
              <kbd>Enter</kbd>
              <span>
                to create "<b>{query.replace(/^[>#/]/, '').trim() || 'Untitled'}</b>"
              </span>
            </div>
          )}
        </div>
        <div className="q-palette-foot">
          <span><kbd>↑↓</kbd> move</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
          <span style={{ marginLeft: 'auto' }}>
            {results.length} match{results.length === 1 ? '' : 'es'}
          </span>
        </div>
      </div>
    </div>
  );
}
