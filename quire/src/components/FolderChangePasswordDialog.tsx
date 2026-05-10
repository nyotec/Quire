import { useState } from 'react';
import type { Folder } from '../types';
import { PasswordStrengthMeter, scorePassword } from './PasswordStrengthMeter';
import { useShortcuts } from '../lib/hotkeys';

interface Props {
  open: boolean;
  folder: Folder | null;
  variant: 'change' | 'disable';
  onCancel: () => void;
  onVerifyCurrent: (folder: Folder, currentPassword: string) => Promise<boolean>;
  onCommit: (args: {
    folder: Folder;
    currentPassword: string;
    newPassword?: string;
  }) => Promise<void>;
}

type Phase = 'enter' | 'working' | 'error';

export function FolderChangePasswordDialog({
  open,
  folder,
  variant,
  onCancel,
  onVerifyCurrent,
  onCommit,
}: Props) {
  const [phase, setPhase] = useState<Phase>('enter');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useShortcuts((action) => {
    if (!open) return false;
    if (action === 'esc' && phase !== 'working') {
      onCancel();
      return true;
    }
    return false;
  });

  if (!open || !folder) return null;

  const validNew = next.length >= 8 && next === confirm;
  const canSubmit =
    variant === 'disable' ? current.length > 0 : current.length > 0 && validNew;

  const submit = async () => {
    if (!canSubmit) return;
    setPhase('working');
    const ok = await onVerifyCurrent(folder, current);
    if (!ok) {
      setPhase('error');
      setErrorMsg('Current password is incorrect.');
      return;
    }
    try {
      await onCommit({
        folder,
        currentPassword: current,
        newPassword: variant === 'change' ? next : undefined,
      });
    } catch (err: any) {
      setPhase('error');
      setErrorMsg(err?.message || 'Failed.');
    }
  };

  return (
    <div className="q-modal-scrim">
      <div className="q-modal q-pw-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="q-modal-title">
          {variant === 'change'
            ? `Change password for "${folder.name}"`
            : `Disable encryption on "${folder.name}"`}
        </div>
        <div className="q-modal-body">
          {variant === 'disable' && (
            <p>
              This decrypts every leaf in this folder. If a parent folder is also
              encrypted, those leaves will be re-encrypted with the parent's key.
            </p>
          )}
          <label className="q-onboard-field">
            <span>Current password</span>
            <input
              autoFocus
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              disabled={phase === 'working'}
            />
          </label>
          {variant === 'change' && (
            <>
              <label className="q-onboard-field" style={{ marginTop: 10 }}>
                <span>New password</span>
                <input
                  type="password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  disabled={phase === 'working'}
                />
              </label>
              <PasswordStrengthMeter password={next} />
              <label className="q-onboard-field" style={{ marginTop: 10 }}>
                <span>Confirm new password</span>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={phase === 'working'}
                  onKeyDown={(e) => e.key === 'Enter' && canSubmit && submit()}
                />
              </label>
              {confirm.length > 0 && next !== confirm && (
                <div className="q-pw-error">Passwords don't match</div>
              )}
              {next.length > 0 && next.length < 8 && (
                <div className="q-pw-error">Password must be at least 8 characters</div>
              )}
              {validNew && scorePassword(next).score < 2 && (
                <div className="q-pw-warn">Weak password — consider a longer one.</div>
              )}
            </>
          )}
          {phase === 'error' && <div className="q-pw-error">{errorMsg}</div>}
        </div>
        <div className="q-modal-actions">
          <button
            className="q-onboard-skip"
            onClick={onCancel}
            disabled={phase === 'working'}
          >
            Cancel
          </button>
          <button
            className="q-btn-primary"
            onClick={submit}
            disabled={!canSubmit || phase === 'working'}
            style={
              !canSubmit || phase === 'working'
                ? { opacity: 0.5, pointerEvents: 'none' }
                : undefined
            }
          >
            {phase === 'working'
              ? 'Working…'
              : variant === 'change'
                ? 'Change password'
                : 'Disable encryption'}
          </button>
        </div>
      </div>
    </div>
  );
}
