import { ReactNode, useEffect } from 'react';
import { useShortcuts } from '../lib/hotkeys';

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Mobile-only slide-in wrapper around the sidebar. Renders nothing when closed,
 * a scrim + drawer when open. Esc closes; clicking the scrim closes.
 */
export function SidebarDrawer({ open, onClose, children }: Props) {
  useShortcuts((action) => {
    if (!open) return false;
    if (action === 'esc') {
      onClose();
      return true;
    }
    return false;
  });

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  return (
    <>
      <div className="q-sidebar-drawer-scrim" onClick={onClose} />
      <aside
        className="q-sidebar-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Sidebar"
      >
        {children}
      </aside>
    </>
  );
}
