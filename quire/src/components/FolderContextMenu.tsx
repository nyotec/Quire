import { useEffect, useRef, useState } from 'react';
import type { Folder } from '../types';
import { Icon } from './Icon';
import { useShortcuts } from '../lib/hotkeys';
import { isFolderUnlocked } from '../lib/lockState';

export interface FolderMenuActions {
  onNewSubfolder: (folder: Folder) => void;
  onRename: (folder: Folder) => void;
  onMove: (folder: Folder) => void;
  onChangeIcon: (folder: Folder) => void;
  onEncrypt: (folder: Folder) => void;
  onChangePassword: (folder: Folder) => void;
  onDisableProtection: (folder: Folder) => void;
  onLockNow: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
}

interface Props {
  folder: Folder | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  actions: FolderMenuActions;
}

export function FolderContextMenu({ folder, position, onClose, actions }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!folder) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [folder, onClose]);

  useShortcuts((action) => {
    if (!folder) return false;
    if (action === 'esc') {
      onClose();
      return true;
    }
    return false;
  });

  if (!folder || !position) return null;

  const isProtected = !!folder.protection;
  const isUnlocked = isProtected && isFolderUnlocked(folder.id);

  // Clamp position to viewport
  const x = Math.min(position.x, window.innerWidth - 220);
  const y = Math.min(position.y, window.innerHeight - 320);

  return (
    <div
      ref={ref}
      className="q-folder-menu"
      style={{ left: x, top: y }}
      role="menu"
      aria-label={`Options for ${folder.name}`}
    >
      <Item icon="plus" onClick={() => { actions.onNewSubfolder(folder); onClose(); }}>
        New folder
      </Item>
      <Item icon="edit" onClick={() => { actions.onRename(folder); onClose(); }}>
        Rename
      </Item>
      <Item icon="arrow" onClick={() => { actions.onMove(folder); onClose(); }}>
        Move…
      </Item>
      <Item icon="dot" onClick={() => { actions.onChangeIcon(folder); onClose(); }}>
        Set icon…
      </Item>
      <div className="q-folder-menu-sep" />
      {!isProtected ? (
        <Item icon="key" onClick={() => { actions.onEncrypt(folder); onClose(); }}>
          Encrypt this folder
        </Item>
      ) : (
        <>
          <Item icon="key" onClick={() => { actions.onChangePassword(folder); onClose(); }}>
            Change password
          </Item>
          <Item icon="unlock" onClick={() => { actions.onDisableProtection(folder); onClose(); }}>
            Disable encryption
          </Item>
          {isUnlocked && (
            <Item icon="lock" onClick={() => { actions.onLockNow(folder); onClose(); }}>
              Lock now
            </Item>
          )}
        </>
      )}
      <div className="q-folder-menu-sep" />
      <Item
        icon="close"
        kind="destructive"
        onClick={() => { actions.onDelete(folder); onClose(); }}
      >
        Delete
      </Item>
    </div>
  );
}

function Item({
  icon,
  onClick,
  children,
  kind,
}: {
  icon: any;
  onClick: () => void;
  children: any;
  kind?: 'destructive';
}) {
  return (
    <button
      className={'q-folder-menu-item' + (kind === 'destructive' ? ' destructive' : '')}
      onClick={onClick}
      role="menuitem"
    >
      <Icon name={icon} size={12} />
      <span>{children}</span>
    </button>
  );
}

// Eager state hook used by the parent to avoid prop-drilling
export function useFolderContextMenuState() {
  const [menu, setMenu] = useState<{
    folder: Folder | null;
    position: { x: number; y: number } | null;
  }>({ folder: null, position: null });
  const open = (folder: Folder, position: { x: number; y: number }) =>
    setMenu({ folder, position });
  const close = () => setMenu({ folder: null, position: null });
  return { menu, open, close };
}
