import { useEffect, useRef, useState } from 'react';
import type { ProtectionConfig, ProtectionMode } from '../types';
import { Icon } from './Icon';
import { formatRel } from '../lib/utils';
import { truncateFilename } from '../lib/filename';
import { useShortcuts } from '../lib/hotkeys';

interface Props {
  mode: ProtectionMode;
  protection: ProtectionConfig;
  filename: string | null;
  lastSaved: string | null;
  /** Curtain mode: any non-modifier key dismisses. */
  onCurtainDismiss?: () => void;
  /** Password mode: submit triggers verifyPassword + onUnlock. */
  onPasswordSubmit?: (password: string) => Promise<boolean>;
  /** Per-session attempt counter and cooldown end. */
  failedAttempts: number;
  cooldownUntil: number;
  /** When provided, render as inert preview (no input handlers). */
  preview?: boolean;
}

const MAX_TITLE_LEN = 40;

export function LockOverlay({
  mode,
  protection,
  filename,
  lastSaved,
  onCurtainDismiss,
  onPasswordSubmit,
  failedAttempts,
  cooldownUntil,
  preview = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pwd, setPwd] = useState('');
  const [shaking, setShaking] = useState(false);
  const [working, setWorking] = useState(false);
  const [tickNow, setTickNow] = useState(Date.now());

  const inCooldown = cooldownUntil > tickNow;
  const cooldownSecs = Math.max(0, Math.ceil((cooldownUntil - tickNow) / 1000));

  // Live cooldown tick
  useEffect(() => {
    if (!inCooldown || preview) return;
    const t = setInterval(() => setTickNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [inCooldown, preview]);

  // Autofocus the input on mount (only in real mode)
  useEffect(() => {
    if (preview) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [preview]);

  // While locked, suppress non-Esc shortcuts
  useShortcuts((action) => {
    if (preview) return false;
    // Curtain mode: any keypress dismisses; this handler catches the few shortcut
    // events that still fire (e.g. ⌘K). We swallow them all and dismiss.
    if (mode === 'curtain') {
      if (action === 'esc' || action === 'palette.open' || action === 'leaf.new') {
        onCurtainDismiss?.();
        return true;
      }
    }
    return false;
  });

  const submit = async () => {
    if (preview || working || inCooldown) return;
    if (mode === 'curtain') {
      onCurtainDismiss?.();
      return;
    }
    if (!onPasswordSubmit || !pwd) return;
    setWorking(true);
    const ok = await onPasswordSubmit(pwd);
    setWorking(false);
    if (!ok) {
      setShaking(true);
      setPwd('');
      setTimeout(() => setShaking(false), 380);
      inputRef.current?.focus();
    }
  };

  const onAnyKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (preview) return;
    if (mode === 'curtain') {
      // Don't dismiss on modifier-only press
      if (
        e.key === 'Shift' ||
        e.key === 'Control' ||
        e.key === 'Alt' ||
        e.key === 'Meta'
      )
        return;
      e.preventDefault();
      onCurtainDismiss?.();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  const hide = !!protection.hideIdentifyingInfo;

  // Zone 1 resolution
  type Zone1 = { kind: 'lockTitle' | 'filename' | 'generic'; text: string };
  let zone1: Zone1;
  if (hide) {
    zone1 = { kind: 'generic', text: 'Locked' };
  } else if (protection.lockTitle && protection.lockTitle.trim()) {
    zone1 = { kind: 'lockTitle', text: protection.lockTitle.trim() };
  } else if (filename) {
    zone1 = { kind: 'filename', text: filename };
  } else {
    zone1 = { kind: 'generic', text: 'Quire' };
  }

  // Zone 2 resolution
  let zone2: { kind: 'filename' | 'subtitle'; text: string } | null = null;
  if (!hide) {
    const subtitle = protection.lockSubtitle?.trim() || '';
    if (zone1.kind === 'lockTitle' && filename) {
      zone2 = { kind: 'filename', text: filename };
    } else if (zone1.kind === 'lockTitle' && subtitle) {
      zone2 = { kind: 'subtitle', text: subtitle };
    } else if (zone1.kind === 'filename' && subtitle) {
      zone2 = { kind: 'subtitle', text: subtitle };
    }
  }

  const showFooter = !hide;

  const truncatedZone1 =
    zone1.kind === 'lockTitle' || zone1.kind === 'filename'
      ? truncateFilename(zone1.text, MAX_TITLE_LEN)
      : zone1.text;

  return (
    <div
      className={'q-lock' + (preview ? ' q-lock-preview' : '')}
      role={preview ? undefined : 'dialog'}
      aria-modal={preview ? undefined : true}
      aria-label="Quire is locked"
    >
      <div className="q-lock-card">
        <div className="q-lock-glyph">
          <Icon name="lock" size={preview ? 28 : 56} />
        </div>

        {/* Zone 1 */}
        <div
          className={
            'q-lock-zone1' +
            (zone1.kind === 'filename' ? ' q-lock-mono' : '') +
            (hide ? ' q-lock-generic' : '')
          }
          title={zone1.text}
        >
          {truncatedZone1}
        </div>

        {/* Zone 2 */}
        {zone2 && (
          <div
            className={'q-lock-zone2' + (zone2.kind === 'filename' ? ' q-lock-mono' : '')}
            title={zone2.text}
          >
            {truncateFilename(zone2.text, 60)}
          </div>
        )}

        {/* Input */}
        <input
          ref={inputRef}
          className={
            'q-lock-input' +
            (mode === 'password' ? ' q-lock-input-pw' : '') +
            (shaking ? ' q-lock-shake' : '') +
            (failedAttempts > 0 && mode === 'password' ? ' q-lock-flash' : '')
          }
          type={mode === 'password' ? 'password' : 'text'}
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          onKeyDown={onAnyKey}
          disabled={preview || working || (mode === 'password' && inCooldown)}
          aria-label={mode === 'password' ? 'Password' : 'Press any key to resume'}
          autoComplete="off"
          spellCheck={false}
        />

        <div className="q-lock-hint">
          {working
            ? 'Unlocking…'
            : mode === 'password'
              ? inCooldown
                ? `Try again in ${cooldownSecs}s`
                : 'Enter your password'
              : 'Press Enter or any key to resume'}
        </div>

        {/* Zone 3 footer */}
        {showFooter && (
          <div className="q-lock-foot">
            <div>{lastSaved ? `Saved ${formatRel(lastSaved)}` : 'Not yet saved'}</div>
            <div>{mode === 'password' ? 'Password mode' : 'Curtain mode'}</div>
          </div>
        )}
      </div>
    </div>
  );
}
