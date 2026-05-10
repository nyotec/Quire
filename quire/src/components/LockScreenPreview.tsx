import type { ProtectionConfig, ProtectionMode } from '../types';
import { LockOverlay } from './LockOverlay';

interface Props {
  mode: ProtectionMode;
  protection: ProtectionConfig;
  filename: string | null;
  lastSaved: string | null;
}

export function LockScreenPreview(props: Props) {
  return (
    <div className="q-lock-preview-wrap">
      <LockOverlay
        mode={props.mode}
        protection={props.protection}
        filename={props.filename}
        lastSaved={props.lastSaved}
        failedAttempts={0}
        cooldownUntil={0}
        preview
      />
    </div>
  );
}
