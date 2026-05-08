import { useEffect, useState } from 'react';
import type { Settings, AccentName, User, UserID } from '../types';
import { Icon } from './Icon';
import { formatRel } from '../lib/utils';
import { AuthorChip } from './AuthorChip';
import { USER_COLORS } from '../lib/userColors';
import { deriveInitials } from '../lib/users';

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
}: DrawerProps) {
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

          <Section label="Plugins">
            {Object.entries(settings.plugins).map(([id, on]) => (
              <Row key={id} label={pluginLabel(id)}>
                <Toggle value={on} onChange={() => togglePlugin(id)} />
              </Row>
            ))}
          </Section>

          <Section label="About">
            <div className="q-drawer-info">Quire v1.0 — single-file notebook</div>
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
