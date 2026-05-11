import { useEffect, useState } from 'react';
import { useShortcuts } from '../lib/hotkeys';

interface Props {
  open: boolean;
  /** Pre-computed counts from `persistence.previewExportStats()`. */
  stats: { plaintext: number; encrypted: number; masterProtected: boolean } | null;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export function ExportJSONDialog({ open, stats, onCancel, onConfirm }: Props) {
  const [working, setWorking] = useState(false);

  useShortcuts((action) => {
    if (!open) return false;
    if (action === 'esc' && !working) {
      onCancel();
      return true;
    }
    return false;
  });

  useEffect(() => {
    if (!open) setWorking(false);
  }, [open]);

  if (!open) return null;

  const confirm = async () => {
    setWorking(true);
    try {
      await onConfirm();
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="q-modal-scrim">
      <div
        className="q-modal q-export-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="q-modal-title">Export to JSON</div>
        <div className="q-modal-body">
          <p>
            This will create a JSON file containing your readable content as{' '}
            <b>plaintext</b>. Anyone who can read the file can read your notes.
          </p>
          {stats && (
            <>
              <p>In this export:</p>
              <ul style={{ paddingLeft: 22 }}>
                <li>
                  <b>{stats.plaintext}</b> leaves will be readable (plaintext)
                </li>
                {stats.encrypted > 0 && (
                  <li>
                    <b>{stats.encrypted}</b> leaves in locked folders will be
                    exported encrypted — their passwords are needed to read them
                    later.
                  </li>
                )}
              </ul>
              {stats.masterProtected && (
                <p className="q-drawer-info">
                  Note: the wiki master password is stripped from the export —
                  the resulting file is not password-protected as a whole.
                </p>
              )}
            </>
          )}
          <p className="q-drawer-info">
            Store this file securely. Treat it like an unencrypted backup.
          </p>
        </div>
        <div className="q-modal-actions">
          <button
            className="q-onboard-skip"
            onClick={onCancel}
            disabled={working}
          >
            Cancel
          </button>
          <button
            className="q-btn-primary"
            onClick={confirm}
            disabled={working}
            style={working ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
          >
            {working ? 'Exporting…' : 'Export to JSON'}
          </button>
        </div>
      </div>
    </div>
  );
}
