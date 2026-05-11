import { Icon } from './Icon';

interface Props {
  open: boolean;
  onStartFresh: () => void;
  onImport: () => void;
}

export function WelcomeScreen({ open, onStartFresh, onImport }: Props) {
  if (!open) return null;
  return (
    <div className="q-welcome-scrim" role="dialog" aria-modal="true">
      <div className="q-welcome-card">
        <div className="q-welcome-mark" aria-hidden="true" />
        <h1 className="q-welcome-title">Welcome to Quire</h1>
        <p className="q-welcome-sub">
          A single-file notebook that goes wherever your file goes.
        </p>
        <div className="q-welcome-options">
          <button className="q-welcome-option" onClick={onStartFresh}>
            <div className="q-welcome-option-icon">
              <Icon name="plus" size={20} />
            </div>
            <div className="q-welcome-option-title">Start fresh</div>
            <div className="q-welcome-option-sub">Begin with a blank wiki</div>
          </button>
          <button className="q-welcome-option" onClick={onImport}>
            <div className="q-welcome-option-icon">
              <Icon name="download" size={20} />
            </div>
            <div className="q-welcome-option-title">Import JSON</div>
            <div className="q-welcome-option-sub">
              Restore from a backup or another file
            </div>
          </button>
        </div>
        <p className="q-welcome-foot">
          Upgrading from an older version? Export to JSON from your old file,
          then click "Import JSON" above.
        </p>
      </div>
    </div>
  );
}
