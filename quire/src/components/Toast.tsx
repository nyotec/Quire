import { useEffect } from 'react';
import type { ToastItem } from '../store/useWikiStore';
import { Icon } from './Icon';

interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="q-toast-stack">
      {toasts.map((t) => (
        <ToastView key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    if (toast.ttl && toast.ttl > 0) {
      const t = setTimeout(() => onDismiss(toast.id), toast.ttl);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [toast, onDismiss]);

  return (
    <div className={'q-toast' + (toast.kind === 'error' ? ' q-toast-error' : '')}>
      <div className="q-toast-msg">{toast.message}</div>
      {toast.action && (
        <button
          className="q-toast-action"
          onClick={() => {
            toast.action!.run();
            onDismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button className="q-toast-close" onClick={() => onDismiss(toast.id)}>
        <Icon name="close" size={10} />
      </button>
    </div>
  );
}
