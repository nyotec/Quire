import { useState } from 'react';
import type { ProtectionConfig } from '../types';
import { LockScreenPreview } from './LockScreenPreview';
import { PasswordStrengthMeter, scorePassword } from './PasswordStrengthMeter';
import { useShortcuts } from '../lib/hotkeys';

export interface SetupResult {
  password: string;
  lockTitle: string;
  lockSubtitle: string;
  hideIdentifyingInfo: boolean;
}

interface Props {
  open: boolean;
  leafCount: number;
  filename: string | null;
  lastSaved: string | null;
  onCancel: () => void;
  onCommit: (r: SetupResult) => Promise<void>;
  onExportJSON: () => void;
}

type Step = 'warn' | 'pwd' | 'ident' | 'confirm' | 'committing';

export function PasswordSetupDialog({
  open,
  leafCount,
  filename,
  lastSaved,
  onCancel,
  onCommit,
  onExportJSON,
}: Props) {
  const [step, setStep] = useState<Step>('warn');
  const [exported, setExported] = useState(false);
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [lockTitle, setLockTitle] = useState('');
  const [lockSubtitle, setLockSubtitle] = useState('');
  const [hideInfo, setHideInfo] = useState(false);

  useShortcuts((action) => {
    if (!open) return false;
    if (action === 'esc') {
      if (step === 'committing') return true; // ignore
      onCancel();
      return true;
    }
    return false;
  });

  if (!open) return null;

  const { score } = scorePassword(pwd);
  const pwdValid = pwd.length >= 8 && pwd === confirm;

  const previewProtection: ProtectionConfig = {
    mode: 'password',
    lockTitle,
    lockSubtitle,
    hideIdentifyingInfo: hideInfo,
  };

  const commit = async () => {
    setStep('committing');
    try {
      await onCommit({
        password: pwd,
        lockTitle: lockTitle.trim(),
        lockSubtitle: lockSubtitle.trim(),
        hideIdentifyingInfo: hideInfo,
      });
    } catch (err) {
      // Stay in committing? Better: surface error and step back.
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
              Before you set a password
            </div>
            <div className="q-modal-body">
              If you forget your password, your notes will be{' '}
              <b>permanently inaccessible</b>. There is no recovery flow. There is
              no support team. There is no backup unless you make one.
              <ol className="q-pw-warnlist">
                <li>Use a password manager. Write the password down somewhere outside this app.</li>
                <li>Export your wiki to JSON now (button below) so you have a plaintext backup if you forget the password.</li>
                <li>Test that you can unlock the wiki immediately after setting the password.</li>
              </ol>
            </div>
            <div className="q-modal-actions">
              <button
                className="q-drawer-btn"
                onClick={() => {
                  onExportJSON();
                  setExported(true);
                }}
              >
                Export JSON backup now
              </button>
              <button className="q-onboard-skip" onClick={onCancel}>Cancel</button>
              <button
                className="q-btn-primary"
                onClick={() => setStep('pwd')}
                disabled={!exported}
                style={!exported ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
              >
                I understand the risk — continue
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
                    e.key === 'Enter' && pwdValid && setStep('ident')
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
                  This password is weak. Consider a longer one or a passphrase.
                </div>
              )}
            </div>
            <div className="q-modal-actions">
              <button className="q-onboard-skip" onClick={onCancel}>Cancel</button>
              <button
                className="q-btn-primary"
                onClick={() => setStep('ident')}
                disabled={!pwdValid}
                style={!pwdValid ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
              >
                Next
              </button>
            </div>
          </>
        )}

        {step === 'ident' && (
          <>
            <div className="q-modal-title">Identify this wiki on the lock screen</div>
            <div className="q-modal-body">
              <p style={{ margin: '0 0 12px' }}>
                When you reopen this file, the lock screen needs to show <i>something</i> so
                you know which wiki you're unlocking. Choose what to display.
              </p>
              <label className="q-onboard-field">
                <span>Lock title</span>
                <input
                  type="text"
                  value={lockTitle}
                  onChange={(e) => setLockTitle(e.target.value)}
                  placeholder="e.g. Personal Journal"
                  disabled={hideInfo}
                />
              </label>
              <label className="q-onboard-field" style={{ marginTop: 10 }}>
                <span>Description</span>
                <input
                  type="text"
                  value={lockSubtitle}
                  onChange={(e) => setLockSubtitle(e.target.value)}
                  placeholder="e.g. Started Jan 2024"
                  disabled={hideInfo}
                />
              </label>
              <label className="q-pw-toggle-row" style={{ marginTop: 12 }}>
                <input
                  type="checkbox"
                  checked={hideInfo}
                  onChange={(e) => setHideInfo(e.target.checked)}
                />{' '}
                <span>
                  <b>Hide identifying info</b> — show only "Locked" with no title, filename,
                  or details. Most private; you'll need to remember which file is which.
                </span>
              </label>
              <div className="q-modal-foot" style={{ marginTop: 8 }}>
                These fields are stored unencrypted in the file so they're readable before
                unlock. Don't put secrets in them.
              </div>
              <div style={{ marginTop: 14 }}>
                <LockScreenPreview
                  mode="password"
                  protection={previewProtection}
                  filename={filename}
                  lastSaved={lastSaved}
                />
              </div>
            </div>
            <div className="q-modal-actions">
              <button className="q-onboard-skip" onClick={() => setStep('pwd')}>Back</button>
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
              <p>
                You're about to encrypt <b>{leafCount}</b>{' '}
                {leafCount === 1 ? 'leaf' : 'leaves'} with this password.
              </p>
              <div style={{ marginTop: 12 }}>
                <LockScreenPreview
                  mode="password"
                  protection={previewProtection}
                  filename={filename}
                  lastSaved={lastSaved}
                />
              </div>
            </div>
            <div className="q-modal-actions">
              <button className="q-onboard-skip" onClick={() => setStep('ident')}>Back</button>
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
