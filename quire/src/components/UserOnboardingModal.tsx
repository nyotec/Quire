import { useEffect, useState } from 'react';
import { deriveInitials } from '../lib/users';

interface Props {
  open: boolean;
  onSubmit: (name: string, initials: string) => void;
}

export function UserOnboardingModal({ open, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [initials, setInitials] = useState('');
  const [touchedInitials, setTouchedInitials] = useState(false);

  useEffect(() => {
    if (!touchedInitials) setInitials(deriveInitials(name));
  }, [name, touchedInitials]);

  if (!open) return null;

  const trimmed = name.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 40 && initials.trim().length >= 1;

  const submit = () => {
    if (!valid) return;
    onSubmit(trimmed, initials.trim().slice(0, 3));
  };

  return (
    <div className="q-modal-scrim">
      <div className="q-modal q-onboard-modal">
        <div className="q-modal-title">Welcome to this Quire</div>
        <div className="q-modal-body">
          What name should appear on notes you create? You can change this later in Settings.
        </div>
        <div className="q-onboard-form">
          <label className="q-onboard-field">
            <span>Name</span>
            <input
              autoFocus
              type="text"
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Your name"
            />
          </label>
          <label className="q-onboard-field q-onboard-field-narrow">
            <span>Initials</span>
            <input
              type="text"
              maxLength={3}
              value={initials}
              onChange={(e) => {
                setInitials(e.target.value);
                setTouchedInitials(true);
              }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Auto"
            />
          </label>
        </div>
        <div className="q-modal-foot">
          A color will be picked for you from the available palette.
        </div>
        <div className="q-modal-actions">
          <button
            className="q-btn-primary"
            onClick={submit}
            disabled={!valid}
            style={!valid ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
