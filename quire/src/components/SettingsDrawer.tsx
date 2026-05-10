import { useEffect, useState } from 'react';
import type {
  Settings,
  AccentName,
  AutolockConfig,
  ProtectionConfig,
  User,
  UserID,
} from '../types';
import { Icon } from './Icon';
import { formatRel } from '../lib/utils';
import { AuthorChip } from './AuthorChip';
import { USER_COLORS } from '../lib/userColors';
import { deriveInitials } from '../lib/users';
import { useShortcuts, shortcutLabel } from '../lib/hotkeys';
import { LockScreenPreview } from './LockScreenPreview';

const ACCENT_HEX: Record<AccentName, string> = {
  ochre: '#b8862e',
  sage: '#7d9968',
  indigo: '#6a6cc4',
  rust: '#c0683e',
  plum: '#995282',
};

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  togglePlugin: (id: string) => void;
  onSave: () => void;
  onExportMarkdown: () => void;
  onExportJSON: () => void;
  onExportSnapshot: () => void;
  onConnectFile?: () => void;
  fileSizeText: string;
  lastSaved: string | null;
  tier: 'A' | 'B' | 'C';
  hasFileHandle: boolean;
  currentUser: User | null;
  users: User[];
  authoredCount: number;
  onUpdateUser: (userId: UserID, patch: Partial<User>) => void;
  onShowShortcuts: () => void;
  // Privacy
  protection: ProtectionConfig;
  autolock: AutolockConfig;
  filename: string | null;
  onSetAutolock: (a: AutolockConfig) => void;
  onSetProtection: (p: ProtectionConfig) => void;
  onLockNow: () => void;
  onEnablePassword: () => void;
  onChangePassword: () => void;
  onDisablePassword: () => void;
  folders: import('../types').Folder[];
  onChangeFolderPassword: (folder: import('../types').Folder) => void;
  onDisableFolderProtection: (folder: import('../types').Folder) => void;
}

export function SettingsDrawer({
  open,
  onClose,
  settings,
  setSetting,
  togglePlugin,
  onSave,
  onExportMarkdown,
  onExportJSON,
  onExportSnapshot,
  onConnectFile,
  fileSizeText,
  lastSaved,
  tier,
  hasFileHandle,
  currentUser,
  users,
  authoredCount,
  onUpdateUser,
  onShowShortcuts,
  protection,
  autolock,
  filename,
  onSetAutolock,
  onSetProtection,
  onLockNow,
  onEnablePassword,
  onChangePassword,
  onDisablePassword,
  folders,
  onChangeFolderPassword,
  onDisableFolderProtection,
}: DrawerProps) {
  useShortcuts((action) => {
    if (!open) return false;
    if (action === 'esc') {
      onClose();
      return true;
    }
    return false;
  });
  if (!open) return null;
  return (
    <>
      <div className="q-drawer-scrim" onClick={onClose} />
      <aside className="q-drawer">
        <div className="q-drawer-head">
          <div className="q-drawer-title">Settings</div>
          <button className="q-icon-btn" onClick={onClose} title="Close">
            <Icon name="close" size={12} />
          </button>
        </div>
        <div className="q-drawer-body">
          {currentUser && (
            <IdentitySection
              user={currentUser}
              users={users}
              authoredCount={authoredCount}
              onUpdate={(patch) => onUpdateUser(currentUser.id, patch)}
            />
          )}

          <Section label="Theme">
            <Row label="Mode">
              <Seg<'paper' | 'ink' | 'mono'>
                value={settings.theme}
                options={['paper', 'ink', 'mono']}
                onChange={(v) => setSetting('theme', v)}
              />
            </Row>
            <Row label="Accent">
              <div className="q-drawer-control">
                {(['ochre', 'sage', 'indigo', 'rust', 'plum'] as AccentName[]).map((a) => (
                  <button
                    key={a}
                    className={'q-swatch' + (settings.accent === a ? ' on' : '')}
                    style={{ background: ACCENT_HEX[a] }}
                    onClick={() => setSetting('accent', a)}
                    title={a}
                  />
                ))}
              </div>
            </Row>
          </Section>

          <Section label="Type">
            <Row label="Pairing">
              <Seg
                value={settings.fontPair}
                options={['editorial', 'modern', 'classic', 'terminal']}
                onChange={(v) => setSetting('fontPair', v)}
              />
            </Row>
          </Section>

          <Section label="Layout">
            <Row label="Flow">
              <Seg
                value={settings.layout}
                options={['river', 'stack']}
                onChange={(v) => setSetting('layout', v)}
              />
            </Row>
            <Row label="Density">
              <Seg
                value={settings.density}
                options={['compact', 'regular', 'comfy']}
                onChange={(v) => setSetting('density', v)}
              />
            </Row>
            <Row label="Sidebar">
              <Toggle value={settings.sidebar} onChange={(v) => setSetting('sidebar', v)} />
            </Row>
            <Row label="Backlinks panel">
              <Toggle value={settings.backlinks} onChange={(v) => setSetting('backlinks', v)} />
            </Row>
            <Row label="Spine numbers">
              <Toggle
                value={settings.spineNumbers}
                onChange={(v) => setSetting('spineNumbers', v)}
              />
            </Row>
          </Section>

          <Section label="Storage">
            {tier === 'A' && !hasFileHandle && onConnectFile && (
              <button className="q-drawer-btn" onClick={onConnectFile}>
                <Icon name="download" size={12} />
                <span>Connect file (auto-save)</span>
              </button>
            )}
            <button className="q-drawer-btn" onClick={onSave}>
              <Icon name="download" size={12} />
              <span>Save Wiki (⌘S)</span>
            </button>
            <button className="q-drawer-btn" onClick={onExportSnapshot}>
              <Icon name="download" size={12} />
              <span>Export snapshot HTML</span>
            </button>
            <button className="q-drawer-btn" onClick={onExportMarkdown}>
              <Icon name="download" size={12} />
              <span>Export markdown ZIP</span>
            </button>
            <button className="q-drawer-btn" onClick={onExportJSON}>
              <Icon name="download" size={12} />
              <span>Export JSON</span>
            </button>
            <div className="q-drawer-info">File size · {fileSizeText}</div>
            <div className="q-drawer-info">
              Last saved · {lastSaved ? formatRel(lastSaved) : 'never'}
            </div>
            <div className="q-drawer-info">Persistence tier · {tier}</div>
          </Section>

          <Section label="Tasks">
            <Row label="Overdue badge in sidebar">
              <Toggle
                value={settings.tasks.showOverdueBadge}
                onChange={(v) =>
                  setSetting('tasks', { ...settings.tasks, showOverdueBadge: v })
                }
              />
            </Row>
            <Row label="Due date format">
              <Seg
                value={settings.tasks.dateFormat}
                options={['relative', 'absolute', 'both']}
                onChange={(v) =>
                  setSetting('tasks', { ...settings.tasks, dateFormat: v })
                }
              />
            </Row>
            <div className="q-drawer-info">
              Reduced motion ·{' '}
              {typeof window !== 'undefined' &&
              window.matchMedia &&
              window.matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 'enabled by OS'
                : 'not active'}
            </div>
          </Section>

          <PrivacySection
            protection={protection}
            autolock={autolock}
            filename={filename}
            lastSaved={lastSaved}
            onSetAutolock={onSetAutolock}
            onSetProtection={onSetProtection}
            onLockNow={onLockNow}
            onEnablePassword={onEnablePassword}
            onChangePassword={onChangePassword}
            onDisablePassword={onDisablePassword}
          />

          <Section label="Folders">
            <div className="q-drawer-info">Total folders · {folders.length}</div>
            <div className="q-drawer-info">
              Protected folders ·{' '}
              {folders.filter((f) => !!f.protection).length}
            </div>
            {folders.filter((f) => !!f.protection).length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {folders
                  .filter((f) => !!f.protection)
                  .map((f) => (
                    <div
                      key={f.id}
                      style={{
                        padding: '6px 8px',
                        border: '0.5px solid var(--q-line)',
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>🔒 {f.name}</div>
                      <div className="q-drawer-info" style={{ marginTop: 2 }}>
                        Hide name ·{' '}
                        {f.protection?.hideName ? 'yes' : 'no'} · Hide count ·{' '}
                        {f.protection?.hideContents ? 'yes' : 'no'}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <button
                          className="q-drawer-btn"
                          style={{ width: 'auto', flex: 1 }}
                          onClick={() => onChangeFolderPassword(f)}
                        >
                          <Icon name="key" size={11} /> Change password
                        </button>
                        <button
                          className="q-drawer-btn"
                          style={{ width: 'auto', flex: 1 }}
                          onClick={() => onDisableFolderProtection(f)}
                        >
                          <Icon name="unlock" size={11} /> Disable
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
            <div className="q-drawer-info" style={{ marginTop: 6 }}>
              Create and manage folders from the sidebar's Folders section.
            </div>
          </Section>

          <Section label="Plugins">
            {Object.entries(settings.plugins).map(([id, on]) => (
              <Row key={id} label={pluginLabel(id)}>
                <Toggle value={on} onChange={() => togglePlugin(id)} />
              </Row>
            ))}
          </Section>

          <Section label="Keyboard shortcuts">
            <div className="q-drawer-info">All shortcuts are listed in the help dialog.</div>
            <button className="q-drawer-btn" onClick={onShowShortcuts}>
              <Icon name="cmd" size={11} /> Show shortcuts
            </button>
          </Section>

          <Section label="About">
            <div className="q-drawer-info">Quire v1.2.1 — single-file notebook</div>
            <div className="q-drawer-info">
              All your data lives inside this HTML file. Email it, drop it on a USB, or open it
              from a folder — it just works.
            </div>
          </Section>
        </div>
      </aside>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="q-drawer-sect">
      <div className="q-drawer-sect-h">{label}</div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="q-drawer-row">
      <div className="q-drawer-label">{label}</div>
      <div className="q-drawer-control">{children}</div>
    </div>
  );
}

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
}) {
  return (
    <>
      {options.map((o) => (
        <button
          key={o}
          className={'q-segbtn' + (value === o ? ' on' : '')}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={'q-toggle' + (value ? ' on' : '')}
      onClick={() => onChange(!value)}
      aria-pressed={value}
    />
  );
}

function IdentitySection({
  user,
  users,
  authoredCount,
  onUpdate,
}: {
  user: User;
  users: User[];
  authoredCount: number;
  onUpdate: (patch: Partial<User>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pickingColor, setPickingColor] = useState(false);
  const [name, setName] = useState(user.name);
  const [initials, setInitials] = useState(user.initials);
  const [touchedInitials, setTouchedInitials] = useState(false);

  useEffect(() => {
    setName(user.name);
    setInitials(user.initials);
    setTouchedInitials(false);
  }, [user.id, user.name, user.initials]);

  useEffect(() => {
    if (!touchedInitials) setInitials(deriveInitials(name));
  }, [name, touchedInitials]);

  const usedByOthers = new Map<string, string>();
  for (const u of users) {
    if (u.id !== user.id) usedByOthers.set(u.color, u.name);
  }

  const save = () => {
    const trimmed = name.trim() || user.name;
    const trimmedInitials = (initials.trim() || deriveInitials(trimmed)).slice(0, 3);
    onUpdate({ name: trimmed, initials: trimmedInitials });
    setEditing(false);
  };

  return (
    <div className="q-drawer-sect">
      <div className="q-drawer-sect-h">Identity</div>
      <div className="q-id-card">
        <AuthorChip user={user} size="md" />
        <div className="q-id-card-meta">
          <div className="q-id-name">{user.name}</div>
          <div className="q-id-sub">
            Joined{' '}
            {user.joined
              ? new Date(user.joined).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
              : 'unknown'}{' '}
            · {authoredCount} {authoredCount === 1 ? 'leaf' : 'leaves'} authored
          </div>
        </div>
      </div>

      {editing ? (
        <div className="q-id-edit">
          <div className="q-id-edit-row">
            <input
              type="text"
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
            />
            <input
              type="text"
              maxLength={3}
              className="q-id-initials"
              value={initials}
              onChange={(e) => {
                setInitials(e.target.value);
                setTouchedInitials(true);
              }}
              placeholder="Initials"
            />
          </div>
          <div className="q-id-edit-row">
            <button className="q-drawer-btn" onClick={save}>
              <Icon name="check" size={11} /> Save
            </button>
            <button
              className="q-drawer-btn"
              onClick={() => {
                setName(user.name);
                setInitials(user.initials);
                setTouchedInitials(false);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="q-drawer-btn" onClick={() => setEditing(true)}>
          <Icon name="edit" size={11} /> Edit name & initials
        </button>
      )}

      {pickingColor ? (
        <div>
          <div className="q-id-color-row">
            {USER_COLORS.map((c) => {
              const usedBy = usedByOthers.get(c);
              return (
                <button
                  key={c}
                  className={
                    'q-id-color' +
                    (user.color === c ? ' on' : '') +
                    (usedBy ? ' q-id-color-used' : '')
                  }
                  style={{ background: c }}
                  title={usedBy ? `(used by ${usedBy})` : ''}
                  onClick={() => onUpdate({ color: c })}
                />
              );
            })}
          </div>
          <div className="q-id-color-note">
            {(() => {
              const usedBy = usedByOthers.get(user.color);
              return usedBy ? `Color also used by ${usedBy}.` : '';
            })()}
          </div>
          <button className="q-drawer-btn" onClick={() => setPickingColor(false)}>
            Done
          </button>
        </div>
      ) : (
        <button className="q-drawer-btn" onClick={() => setPickingColor(true)}>
          <Icon name="dot" size={11} /> Change color
        </button>
      )}

      <div className="q-drawer-info">
        Your identity is remembered by this browser only. If you open this file on another
        device, you'll be asked to identify yourself there too.
      </div>
    </div>
  );
}

function PrivacySection({
  protection,
  autolock,
  filename,
  lastSaved,
  onSetAutolock,
  onSetProtection,
  onLockNow,
  onEnablePassword,
  onChangePassword,
  onDisablePassword,
}: {
  protection: ProtectionConfig;
  autolock: AutolockConfig;
  filename: string | null;
  lastSaved: string | null;
  onSetAutolock: (a: AutolockConfig) => void;
  onSetProtection: (p: ProtectionConfig) => void;
  onLockNow: () => void;
  onEnablePassword: () => void;
  onChangePassword: () => void;
  onDisablePassword: () => void;
}) {
  // Local debounced state for the text fields so we don't write per keystroke
  const [lockTitle, setLockTitle] = useState(protection.lockTitle || '');
  const [lockSubtitle, setLockSubtitle] = useState(protection.lockSubtitle || '');
  useEffect(() => setLockTitle(protection.lockTitle || ''), [protection.lockTitle]);
  useEffect(
    () => setLockSubtitle(protection.lockSubtitle || ''),
    [protection.lockSubtitle],
  );
  useEffect(() => {
    const t = setTimeout(() => {
      if (
        (protection.lockTitle || '') !== lockTitle ||
        (protection.lockSubtitle || '') !== lockSubtitle
      ) {
        onSetProtection({
          ...protection,
          lockTitle: lockTitle || undefined,
          lockSubtitle: lockSubtitle || undefined,
        });
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockTitle, lockSubtitle]);

  const inactivityOptions: { label: string; ms: number }[] = [
    { label: 'Off', ms: 0 },
    { label: '1 min', ms: 60_000 },
    { label: '5 min', ms: 5 * 60_000 },
    { label: '15 min', ms: 15 * 60_000 },
    { label: '30 min', ms: 30 * 60_000 },
  ];
  const hiddenOptions: { label: string; ms: number }[] = [
    { label: 'Off', ms: 0 },
    { label: '10s', ms: 10_000 },
    { label: '30s', ms: 30_000 },
    { label: '2 min', ms: 120_000 },
    { label: '10 min', ms: 600_000 },
  ];

  return (
    <div className="q-drawer-sect">
      <div className="q-drawer-sect-h">Privacy</div>

      <Row label="Auto-lock">
        <select
          className="q-priv-select"
          value={autolock.inactivityTimeoutMs}
          onChange={(e) =>
            onSetAutolock({ ...autolock, inactivityTimeoutMs: Number(e.target.value) })
          }
        >
          {inactivityOptions.map((o) => (
            <option key={o.label} value={o.ms}>
              {o.label}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Tab hidden">
        <select
          className="q-priv-select"
          value={autolock.hiddenTimeoutMs}
          onChange={(e) =>
            onSetAutolock({ ...autolock, hiddenTimeoutMs: Number(e.target.value) })
          }
        >
          {hiddenOptions.map((o) => (
            <option key={o.label} value={o.ms}>
              {o.label}
            </option>
          ))}
        </select>
      </Row>

      <div className="q-drawer-sect-h" style={{ marginTop: 6 }}>
        Lock screen identification
      </div>
      <label className="q-onboard-field">
        <span>Lock title</span>
        <input
          type="text"
          value={lockTitle}
          onChange={(e) => setLockTitle(e.target.value)}
          placeholder="e.g. Personal Journal"
          disabled={!!protection.hideIdentifyingInfo}
        />
      </label>
      <label className="q-onboard-field" style={{ marginTop: 8 }}>
        <span>Description</span>
        <input
          type="text"
          value={lockSubtitle}
          onChange={(e) => setLockSubtitle(e.target.value)}
          placeholder="e.g. Started Jan 2024"
          disabled={!!protection.hideIdentifyingInfo}
        />
      </label>
      <Row label="Hide identifying info">
        <Toggle
          value={!!protection.hideIdentifyingInfo}
          onChange={(v) => onSetProtection({ ...protection, hideIdentifyingInfo: v })}
        />
      </Row>
      {protection.hideIdentifyingInfo && (
        <div className="q-drawer-info">Saved but hidden on lock screen.</div>
      )}

      <div className="q-drawer-info" style={{ marginTop: 6 }}>
        Preview:
      </div>
      <LockScreenPreview
        mode={protection.mode}
        protection={protection}
        filename={filename}
        lastSaved={lastSaved}
      />

      <div className="q-priv-status">
        Status:{' '}
        {protection.mode === 'password'
          ? 'Password mode — leaves encrypted with AES-GCM'
          : 'Curtain mode (visual hiding only)'}
      </div>

      {protection.mode === 'password' ? (
        <>
          <div className="q-drawer-info">
            Key derivation: PBKDF2 / {protection.iterations?.toLocaleString() ?? '?'}{' '}
            iterations
          </div>
          <button className="q-drawer-btn" onClick={onChangePassword}>
            <Icon name="key" size={11} /> Change password
          </button>
          <button className="q-drawer-btn" onClick={onDisablePassword}>
            <Icon name="unlock" size={11} /> Disable password protection
          </button>
        </>
      ) : (
        <button className="q-drawer-btn" onClick={onEnablePassword}>
          <Icon name="key" size={11} /> Enable password protection
        </button>
      )}

      <div className="q-drawer-info" style={{ marginTop: 6 }}>
        Manual lock: {shortcutLabel('lock.now')}
      </div>
      <button className="q-drawer-btn" onClick={onLockNow}>
        <Icon name="lock" size={11} /> Lock now
      </button>
    </div>
  );
}

function pluginLabel(id: string): string {
  const map: Record<string, string> = {
    backlinks: 'Backlinks',
    graph: 'Graph view',
    math: 'Math (KaTeX)',
    code: 'Code highlight',
    wordcount: 'Word count',
    darkjournal: 'Dark journal',
  };
  return map[id] || id;
}
