import { Icon } from './Icon';

interface Props {
  open: boolean;
  variant: 'seeded' | 'empty';
  onDismiss: () => void;
  onImport: () => void;
  onCreateNote: () => void;
}

export function IntroCard({
  open,
  variant,
  onDismiss,
  onImport,
  onCreateNote,
}: Props) {
  if (!open) return null;
  return (
    <div className="q-intro-card" role="region" aria-label="Welcome to Quire">
      <button
        className="q-intro-card-close"
        onClick={onDismiss}
        title="Dismiss"
        aria-label="Dismiss"
      >
        <Icon name="close" size={11} />
      </button>
      <div className="q-intro-card-emoji" aria-hidden="true">👋</div>
      <div className="q-intro-card-title">Welcome to Quire</div>
      {variant === 'seeded' ? (
        <>
          <div className="q-intro-card-body">
            The notes on the left explain how this works. Edit them, delete
            them, or write your own.
          </div>
          <div className="q-intro-card-actions">
            <button className="q-btn-primary" onClick={onDismiss}>
              Got it
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="q-intro-card-body">
            This wiki is empty. Click below to create your first note, or
            restore from a backup.
          </div>
          <div className="q-intro-card-actions">
            <button
              className="q-btn-primary"
              onClick={() => {
                onCreateNote();
                onDismiss();
              }}
            >
              Create a note
            </button>
          </div>
        </>
      )}
      <button className="q-intro-card-link" onClick={onImport}>
        Restore from a backup →
      </button>
    </div>
  );
}
