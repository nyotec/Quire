import type { Settings, AccentName } from '../types';
import { Icon } from './Icon';
import { formatRel } from '../lib/utils';

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
