import { useEffect } from 'react';
import {
  ShortcutAction,
  isMac,
  shortcutActionLabel,
  shortcutLabel,
  useShortcuts,
} from '../lib/hotkeys';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Group {
  title: string;
  actions: ShortcutAction[];
}

const GROUPS: Group[] = [
  {
    title: 'Navigation',
    actions: ['palette.open', 'tasks.toggle', 'leaf.focusNext', 'leaf.focusPrev'],
  },
  {
    title: 'Editing',
    actions: [
      'leaf.new',
      'leaf.toggleEdit',
      'leaf.close',
      'leaf.moveLeft',
      'leaf.moveRight',
    ],
  },
  {
    title: 'System',
    actions: ['wiki.save', 'settings.toggle', 'help.show', 'esc'],
  },
];

export function ShortcutHelpDialog({ open, onClose }: Props) {
  useShortcuts((action) => {
    if (!open) return false;
    if (action === 'esc') {
      onClose();
      return true;
    }
    return false;
  });

  // Block body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="q-modal-scrim" onClick={onClose}>
      <div className="q-modal q-shortcut-help" onClick={(e) => e.stopPropagation()}>
        <div className="q-modal-title">Keyboard shortcuts</div>
        <div className="q-shortcut-grid">
          {GROUPS.map((g) => (
            <div className="q-shortcut-col" key={g.title}>
              <div className="q-shortcut-col-h">{g.title}</div>
              {g.actions.map((a) => (
                <div className="q-shortcut-row" key={a}>
                  <span className="q-shortcut-label">{shortcutActionLabel(a)}</span>
                  <span className="q-shortcut-chip">{shortcutLabel(a)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        {isMac && (
          <div className="q-modal-foot">
            Symbols: ⌘ Cmd · ⇧ Shift · ⌥ Option · ⌫ Delete
          </div>
        )}
        <div className="q-modal-actions">
          <button className="q-btn-primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
