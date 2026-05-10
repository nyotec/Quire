import { useEffect } from 'react';

export const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

export type ShortcutAction =
  | 'palette.open'
  | 'leaf.new'
  | 'leaf.toggleEdit'
  | 'leaf.close'
  | 'leaf.moveLeft'
  | 'leaf.moveRight'
  | 'leaf.focusNext'
  | 'leaf.focusPrev'
  | 'wiki.save'
  | 'settings.toggle'
  | 'tasks.toggle'
  | 'help.show'
  | 'lock.now'
  | 'esc';

interface Binding {
  /** event.code value, e.g. "KeyJ", "Enter". Use null for key-based matching. */
  code: string | null;
  /** event.key value when matching by character (e.g. "?"). */
  key: string | null;
  /** Require the platform's primary modifier (Cmd on Mac, Ctrl elsewhere). */
  primary: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Whether this shortcut fires when text input is focused. */
  inInput: boolean;
}

const BINDINGS: Record<ShortcutAction, Binding> = {
  'palette.open':    { code: 'KeyK',         key: null, primary: true,  inInput: true  },
  'leaf.new':        { code: 'KeyJ',         key: null, primary: true,  inInput: false },
  'leaf.toggleEdit': { code: 'Enter',        key: null, primary: true,  inInput: true  },
  'leaf.close':      { code: 'Backspace',    key: null, primary: true,  inInput: false },
  'leaf.moveLeft':   { code: 'BracketLeft',  key: null, primary: true,  shift: true, inInput: false },
  'leaf.moveRight':  { code: 'BracketRight', key: null, primary: true,  shift: true, inInput: false },
  'leaf.focusNext':  { code: 'Tab',          key: null, primary: false, inInput: false },
  'leaf.focusPrev':  { code: 'Tab',          key: null, primary: false, shift: true, inInput: false },
  'wiki.save':       { code: 'KeyS',         key: null, primary: true,  inInput: true  },
  'settings.toggle': { code: 'Comma',        key: null, primary: true,  inInput: true  },
  'tasks.toggle':    { code: 'KeyK',         key: null, primary: true,  shift: true, inInput: false },
  'help.show':       { code: null,           key: '?',  primary: false, inInput: false },
  'lock.now':        { code: 'Semicolon',    key: null, primary: true,  inInput: true  },
  'esc':             { code: 'Escape',       key: null, primary: false, inInput: true  },
};

/** When set to true, only `esc` and the password input itself receive events. */
let suppressed = false;
export function setShortcutsSuppressed(v: boolean) {
  suppressed = v;
}

function isInputFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') {
    const type = ((el as HTMLInputElement).type || 'text').toLowerCase();
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file'].includes(type);
  }
  if (el.isContentEditable) return true;
  return false;
}

function matches(event: KeyboardEvent, b: Binding): boolean {
  // Modifier check
  const wantsPrimary = b.primary;
  const hasPrimary = isMac ? event.metaKey : event.ctrlKey;
  const otherPrimary = isMac ? event.ctrlKey : event.metaKey;
  if (wantsPrimary !== hasPrimary) return false;
  // Reject the cross-platform modifier — keeps Ctrl on Mac and Cmd on Win clean.
  if (otherPrimary) return false;
  // Shift / alt
  if ((b.shift ?? false) !== event.shiftKey) return false;
  if ((b.alt ?? false) !== event.altKey) return false;
  // Key
  if (b.code !== null && event.code !== b.code) return false;
  if (b.key !== null && event.key !== b.key) return false;
  return true;
}

/** Returning true from a handler means "consumed; stop processing". */
export type ShortcutHandler = (action: ShortcutAction, event: KeyboardEvent) => boolean;

let handlers: ShortcutHandler[] = [];

export function registerShortcutHandler(h: ShortcutHandler): () => void {
  // Most-recently-added wins (LIFO) so modal layers consume first.
  handlers = [h, ...handlers];
  return () => {
    handlers = handlers.filter((x) => x !== h);
  };
}

let listenerInstalled = false;

function onKeyDown(event: KeyboardEvent) {
  const inInput = isInputFocused();
  for (const action of Object.keys(BINDINGS) as ShortcutAction[]) {
    const b = BINDINGS[action];
    if (!matches(event, b)) continue;
    if (inInput && !b.inInput) continue;
    // While suppressed (lock screen showing), only let `esc` reach handlers.
    if (suppressed && action !== 'esc') return;
    for (const h of handlers) {
      if (h(action, event)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }
    // No handler claimed it — leave the event alone (do not preventDefault).
    return;
  }
}

export function installShortcutListener() {
  if (listenerInstalled || typeof document === 'undefined') return;
  document.addEventListener('keydown', onKeyDown);
  listenerInstalled = true;
}

/** React hook: register a handler for the lifetime of a component. */
export function useShortcuts(handler: ShortcutHandler) {
  useEffect(() => {
    installShortcutListener();
    return registerShortcutHandler(handler);
  }, [handler]);
}

/** Human-readable label for a shortcut action. */
export function shortcutLabel(action: ShortcutAction): string {
  const b = BINDINGS[action];
  const parts: string[] = [];
  if (b.primary) parts.push(isMac ? '⌘' : 'Ctrl');
  if (b.shift) parts.push(isMac ? '⇧' : 'Shift');
  if (b.alt) parts.push(isMac ? '⌥' : 'Alt');
  let keyLabel: string;
  if (b.key) {
    keyLabel = b.key;
  } else {
    const macMap: Record<string, string> = {
      KeyJ: 'J',
      KeyK: 'K',
      KeyS: 'S',
      Enter: 'Return',
      Backspace: '⌫',
      BracketLeft: '[',
      BracketRight: ']',
      Comma: ',',
      Semicolon: ';',
      Tab: 'Tab',
      Escape: 'Esc',
    };
    const winMap: Record<string, string> = {
      KeyJ: 'J',
      KeyK: 'K',
      KeyS: 'S',
      Enter: 'Enter',
      Backspace: 'Backspace',
      BracketLeft: '[',
      BracketRight: ']',
      Comma: ',',
      Semicolon: ';',
      Tab: 'Tab',
      Escape: 'Esc',
    };
    const map = isMac ? macMap : winMap;
    keyLabel = map[b.code ?? ''] ?? b.code ?? '?';
  }
  parts.push(keyLabel);
  return isMac ? parts.join('') : parts.join('+');
}

/** All registered actions, useful for the help dialog. */
export const ALL_SHORTCUT_ACTIONS = Object.keys(BINDINGS) as ShortcutAction[];

/** Short label suitable for an action in the help dialog. */
export function shortcutActionLabel(action: ShortcutAction): string {
  switch (action) {
    case 'palette.open':
      return 'Command palette';
    case 'leaf.new':
      return 'New leaf';
    case 'leaf.toggleEdit':
      return 'Toggle edit mode';
    case 'leaf.close':
      return 'Close focused leaf';
    case 'leaf.moveLeft':
      return 'Move leaf left';
    case 'leaf.moveRight':
      return 'Move leaf right';
    case 'leaf.focusNext':
      return 'Next leaf';
    case 'leaf.focusPrev':
      return 'Previous leaf';
    case 'wiki.save':
      return 'Save Wiki';
    case 'settings.toggle':
      return 'Settings';
    case 'tasks.toggle':
      return 'Tasks view';
    case 'help.show':
      return 'Keyboard shortcuts help';
    case 'lock.now':
      return 'Lock now';
    case 'esc':
      return 'Close palette / drawer / dialog';
  }
}
