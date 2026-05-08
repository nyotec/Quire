import { useEffect } from 'react';

export interface HotkeySpec {
  key: string;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export function useHotkey(
  spec: HotkeySpec | HotkeySpec[],
  handler: (e: KeyboardEvent) => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;
    const specs = Array.isArray(spec) ? spec : [spec];
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      for (const s of specs) {
        const wantMeta = !!s.meta;
        const wantShift = !!s.shift;
        const wantAlt = !!s.alt;
        if (wantMeta !== meta) continue;
        if (wantShift !== e.shiftKey) continue;
        if (wantAlt !== e.altKey) continue;
        if (e.key.toLowerCase() === s.key.toLowerCase()) {
          handler(e);
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spec, handler, enabled]);
}

export function useGlobalHotkeys(handler: (e: KeyboardEvent) => void) {
  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}
