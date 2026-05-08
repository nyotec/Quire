import { Icon } from './Icon';
import type { ThemeName, SaveStatus } from '../types';
import { formatRel } from '../lib/utils';

interface TopBarProps {
  onCmd: () => void;
  onNew: () => void;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
  onStatusClick: () => void;
  theme: ThemeName;
  sidebarOpen: boolean;
  count: number;
  query: string;
  saveStatus: SaveStatus;
}

function statusLabel(s: SaveStatus): { className: string; dot: string; text: string } {
  if (s.tier === 'C') return { className: 'q-status-pill q-status-browser', dot: 'q-status-dot', text: 'Browser only' };
  switch (s.state) {
    case 'saving':
      return { className: 'q-status-pill q-status-saving', dot: 'q-status-dot', text: 'Saving…' };
    case 'error':
      return { className: 'q-status-pill q-status-error', dot: 'q-status-dot', text: 'Save failed · retry' };
    case 'dirty':
      return {
        className: 'q-status-pill q-status-dirty',
        dot: 'q-status-dot',
        text: s.tier === 'B' ? `Draft · ${s.pendingChanges} change${s.pendingChanges === 1 ? '' : 's'}` : 'Dirty · click to save',
      };
    case 'browser-only':
      return { className: 'q-status-pill q-status-browser', dot: 'q-status-dot', text: 'Browser only' };
    case 'saved':
    default:
      return {
        className: 'q-status-pill q-status-saved',
        dot: 'q-status-dot',
        text: s.lastSaved ? `Saved · ${formatRel(s.lastSaved)}` : 'Ready',
      };
  }
}

export function TopBar({
  onCmd,
  onNew,
  onToggleTheme,
  onToggleSidebar,
  onOpenSettings,
  onStatusClick,
  theme,
  sidebarOpen,
  count,
  query,
  saveStatus,
}: TopBarProps) {
  const st = statusLabel(saveStatus);
  return (
    <header className="q-top">
      <div className="q-top-l">
        <button className="q-icon-btn" onClick={onToggleSidebar} title={sidebarOpen ? 'Hide index' : 'Show index'}>
          <Icon name="sidebar" />
        </button>
        <div className="q-brand">
          <span className="q-brand-mark" />
          <span className="q-brand-name">Quire</span>
          <span className="q-brand-meta">{count} leaves · single file</span>
        </div>
        <button className={st.className} onClick={onStatusClick} title="Save status">
          <span className={st.dot} />
          <span>{st.text}</span>
        </button>
      </div>
      <div className="q-top-c">
        <div className="q-search-pill" onClick={onCmd}>
          <Icon name="search" size={13} />
          <input
            type="text"
            className="q-search-input"
            placeholder="Search, command, or jump…"
            value={query}
            readOnly
          />
          <kbd className="q-kbd">⌘K</kbd>
        </div>
      </div>
      <div className="q-top-r">
        <button className="q-icon-btn" onClick={onToggleTheme} title="Cycle theme">
          <Icon name={theme === 'ink' ? 'moon' : theme === 'mono' ? 'dot' : 'sun'} />
        </button>
        <button className="q-icon-btn" onClick={onOpenSettings} title="Settings (⌘,)">
          <Icon name="gear" />
        </button>
        <button className="q-btn-primary" onClick={onNew}>
          <Icon name="plus" size={11} /> New leaf <kbd className="q-kbd q-kbd-on">⌘N</kbd>
        </button>
      </div>
    </header>
  );
}
