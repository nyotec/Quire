import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { useWikiStore } from '../store/useWikiStore';
import { persistence } from '../store/persistence';
import { formatRel } from '../lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Always-visible debug overlay for diagnosing issues.  Surfaces the current
 * wiki state, persistence tier, encoding, and offers a "Copy debug info"
 * button so users can paste a snapshot into a bug report.
 */
export function DebugPanel({ open, onClose }: Props) {
  const [, tick] = useState(0);
  // Update once per second so "last saved" stays fresh
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [open]);

  if (!open) return null;

  const s = useWikiStore.getState();
  const dataBlock = document.getElementById('quire-data');
  const tier = persistence.detectTier();
  const status = persistence.getStatus();
  const encoding = dataBlock?.getAttribute('data-encoding') || 'plain';
  const dataLength = dataBlock?.textContent?.length ?? 0;

  const lines: Array<[string, string]> = [
    ['Quire', '1.6.1'],
    ['Schema', `v${s.schemaVersion}`],
    ['Wiki ID', s.wikiId],
    ['Leaves', String(s.leaves.length)],
    ['Folders', String(s.folders.length)],
    ['Users', String(s.users.length)],
    ['Last saved', status.lastSaved ? formatRel(status.lastSaved) : 'never'],
    ['Persistence tier', tier === 'A' ? 'A (FS Access)' : tier === 'B' ? 'B (download)' : 'C (IDB only)'],
    ['Data block', `${dataLength.toLocaleString()} chars (${encoding})`],
    [
      'Browser',
      typeof navigator !== 'undefined'
        ? `${navigator.userAgent.split(/[()]/)[0].trim().slice(0, 60)}`
        : 'unknown',
    ],
  ];

  const copyAll = async () => {
    const txt = lines.map(([k, v]) => `${k}: ${v}`).join('\n');
    try {
      await navigator.clipboard.writeText(txt);
      useWikiStore.getState().pushToast({
        message: 'Debug info copied.',
        ttl: 3000,
      });
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="q-debug-panel"
      role="region"
      aria-label="Debug info"
    >
      <div className="q-debug-panel-head">
        <span className="q-debug-panel-title">Debug info</span>
        <button
          className="q-icon-btn"
          onClick={onClose}
          title="Close"
          aria-label="Close"
          style={{ width: 22, height: 22 }}
        >
          <Icon name="close" size={10} />
        </button>
      </div>
      {lines.map(([k, v]) => (
        <div className="q-debug-panel-row" key={k}>
          <span className="q-debug-panel-key">{k}</span>
          <span className="q-debug-panel-val">{v}</span>
        </div>
      ))}
      <div className="q-debug-panel-actions">
        <button
          className="q-drawer-btn"
          style={{ width: '100%' }}
          onClick={copyAll}
        >
          Copy debug info to clipboard
        </button>
      </div>
    </div>
  );
}
