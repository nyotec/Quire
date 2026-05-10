import { useEffect, useRef, useState } from 'react';
import type { Folder, Leaf } from '../types';
import { Icon } from './Icon';
import { leavesInFolder } from '../lib/folders';

interface Props {
  folder: Folder;
  folders: Folder[];
  leaves: Leaf[];
  onUnlock: (password: string) => Promise<boolean>;
  onCancel: () => void;
}

export function FolderUnlockCard({ folder, folders, leaves, onUnlock, onCancel }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [pwd, setPwd] = useState('');
  const [working, setWorking] = useState(false);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    setTimeout(() => ref.current?.focus(), 30);
  }, []);

  const submit = async () => {
    if (working || !pwd) return;
    setWorking(true);
    const ok = await onUnlock(pwd);
    setWorking(false);
    if (!ok) {
      setShaking(true);
      setPwd('');
      setTimeout(() => setShaking(false), 380);
      ref.current?.focus();
    }
  };

  const count = leavesInFolder(leaves, folders, folder.id, true).length;
  const hideContents = !!folder.protection?.hideContents;
  const hideName = !!folder.protection?.hideName;
  const displayName = hideName ? 'Locked' : folder.name;

  return (
    <article className="q-leaf q-leaf-folder-unlock focused">
      <div className="q-folder-unlock-body">
        <div className="q-folder-unlock-glyph">
          <Icon name="lock" size={32} />
        </div>
        <h2 className="q-folder-unlock-title">{displayName}</h2>
        {!hideContents && (
          <div className="q-folder-unlock-meta">
            {count} {count === 1 ? 'leaf' : 'leaves'} · Locked
          </div>
        )}
        <input
          ref={ref}
          type="password"
          className={'q-lock-input q-lock-input-pw' + (shaking ? ' q-lock-shake' : '')}
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
          }}
          placeholder="Enter password"
          disabled={working}
          autoComplete="current-password"
          spellCheck={false}
        />
        <div className="q-folder-unlock-hint">
          {working ? 'Unlocking…' : 'Press Enter to unlock'}
        </div>
        <div className="q-folder-unlock-actions">
          <button className="q-onboard-skip" onClick={onCancel} disabled={working}>
            Cancel
          </button>
          <button
            className="q-btn-primary"
            onClick={submit}
            disabled={working || !pwd}
            style={!pwd || working ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
          >
            Unlock
          </button>
        </div>
      </div>
    </article>
  );
}
