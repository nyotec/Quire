import { useState } from 'react';
import type { Folder } from '../types';
import { PasswordStrengthMeter, scorePassword } from './PasswordStrengthMeter';
import { useShortcuts } from '../lib/hotkeys';

interface Props {
  open: boolean;
  folder: Folder | null;
  leafCount: number;
  onCancel: () => void;
  onCommit: (args: {
    password: string;
    hideName: boolean;
    hideContents: boolean;
  }) => Promise<void>;
  onExportFolder: (folder: Folder) => void;
}

type Step = 'warn' | 'pwd' | 'visibility' | 'confirm' | 'committing';

export function FolderEncryptDialog({
  open,
  folder,
  leafCount,
  onCancel,
  onCommit,
  onExportFolder,
}: Props) {
  const [step, setStep] = useState<Step>('warn');
  const [exported, setExported] = useState(false);
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [hideName, setHideName] = useState(false);
  const [hideContents, setHideContents] = useState(false);

  useShortcuts((action) => {
    if (!open) return false;
    if (action === 'esc' && step !== 'committing') {
      onCancel();
      return true;
    }
    return false;
  });

  if (!open || !folder) return null;

  const { score } = scorePassword(pwd);
  const pwdValid = pwd.length >= 8 && pwd === confirm;

  const commit = async () => {
    setStep('committing');
    try {
      await onCommit({ password: pwd, hideName, hideContents });
    } catch (err) {
      console.error(err);
      setStep('confirm');
    }
  };

  return (
    <div className="q-modal-scrim">
      <div className="q-modal q-pw-dialog" onClick={(e) => e.stopPropagation()}>
        {step === 'warn' && (
          <>
            <div className="q-modal-title q-modal-title-warn">
              Encrypting "{folder.name}"
            </div>
            <div className="q-modal-body">
              This folder contains <b>{leafCount}</b>{' '}
              {leafCount === 1 ? 'leaf' : 'leaves'}. After encryption:
              <ol className="q-pw-warnlist">
                <li>
                  Their content will be unreadable without the password. If you
                  forget the password, the content is permanently inaccessible.
                </li>
                <li>
                  Independent of any wiki master password — you can have either,
                  both, or neither.
                </li>
                <li>
                  Sharing the file shares the encrypted data; recipients without
                  the password can't read this folder.
                </li>
              </ol>
              Export this folder's leaves to JSON before encrypting, in case you
              forget the password.
            </div>
            <div className="q-modal-actions">
              <button
                className="q-drawer-btn"
                onClick={() => {
                  onExportFolder(folder);
                  setExported(true);
                }}
              >
                Export this folder as JSON
              </button>
              <button className="q-onboard-skip" onClick={onCancel}>
                Cancel
              </button>
              <button
                className="q-btn-primary"
                onClick={() => setStep('pwd')}
                disabled={!exported}
                style={!exported ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
              >
                I understand — continue
              </button>
            </div>
          </>
        )}

        {step === 'pwd' && (
          <>
            <div className="q-modal-title">Choose a password</div>
            <div className="q-modal-body">
              <label className="q-onboard-field">
                <span>Password</span>
                <input
                  autoFocus
                  type="password"
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                />
              </label>
              <PasswordStrengthMeter password={pwd} />
              <label className="q-onboard-field" style={{ marginTop: 10 }}>
                <span>Confirm password</span>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && pwdValid && setStep('visibility')
                  }
                />
              </label>
              {confirm.length > 0 && pwd !== confirm && (
                <div className="q-pw-error">Passwords don't match</div>
              )}
              {pwd.length > 0 && pwd.length < 8 && (
                <div className="q-pw-error">Password must be at least 8 characters</div>
              )}
              {score < 2 && pwdValid && (
                <div className="q-pw-warn">
                  This password is weak. Consider a longer one.
                </div>
              )}
            </div>
            <div className="q-modal-actions">
              <button className="q-onboard-skip" onClick={onCancel}>
                Cancel
              </button>
              <button
                className="q-btn-primary"
                onClick={() => setStep('visibility')}
                disabled={!pwdValid}
                style={!pwdValid ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
              >
                Next
              </button>
            </div>
          </>
        )}

        {step === 'visibility' && (
          <>
            <div className="q-modal-title">Visibility while locked</div>
            <div className="q-modal-body">
              <p style={{ margin: '0 0 8px' }}>
                When this folder is locked, others (and your future self) will see:
              </p>
              <ul style={{ paddingLeft: 22, margin: '0 0 12px' }}>
                <li>Folder name {hideName ? <i>(suppressed)</i> : `("${folder.name}")`}</li>
                <li>
                  Number of leaves inside{' '}
                  {hideContents ? <i>(suppressed)</i> : `(${leafCount})`}
                </li>
                <li>
                  Leaf titles and bodies are <b>always</b> hidden when locked.
                </li>
              </ul>
              <label className="q-pw-toggle-row">
                <input
                  type="checkbox"
                  checked={hideName}
                  onChange={(e) => setHideName(e.target.checked)}
                />{' '}
                <span>
                  <b>Hide folder name</b> — show only "Locked"
                </span>
              </label>
              <label className="q-pw-toggle-row" style={{ marginTop: 6 }}>
                <input
                  type="checkbox"
                  checked={hideContents}
                  onChange={(e) => setHideContents(e.target.checked)}
                />{' '}
                <span>
                  <b>Hide leaf count</b>
                </span>
              </label>
            </div>
            <div className="q-modal-actions">
              <button className="q-onboard-skip" onClick={() => setStep('pwd')}>
                Back
              </button>
              <button className="q-btn-primary" onClick={() => setStep('confirm')}>
                Next
              </button>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className="q-modal-title">Confirm</div>
            <div className="q-modal-body">
              You're about to encrypt <b>{leafCount}</b>{' '}
              {leafCount === 1 ? 'leaf' : 'leaves'} in <b>"{folder.name}"</b> with this password.
              {hideName && <p>Folder name will be hidden as "Locked" while locked.</p>}
              {hideContents && <p>Leaf count will be hidden while locked.</p>}
            </div>
            <div className="q-modal-actions">
              <button className="q-onboard-skip" onClick={() => setStep('visibility')}>
                Back
              </button>
              <button className="q-btn-primary" onClick={commit}>
                Encrypt and protect
              </button>
            </div>
          </>
        )}

        {step === 'committing' && (
          <>
            <div className="q-modal-title">Encrypting…</div>
            <div className="q-modal-body">
              Deriving key and encrypting {leafCount} leaves. This takes a moment.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
