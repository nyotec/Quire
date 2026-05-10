import { useEffect, useState } from 'react';

/**
 * Reactive `window.matchMedia` hook. Returns the current match state and
 * updates when the query starts/stops matching (e.g. on rotation, on resize).
 *
 * SSR-safe: defaults to false on the server.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    // Modern browsers
    mq.addEventListener('change', handler);
    // Sync once on attach in case the value changed between render and effect
    setMatches(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// Breakpoints — keep in sync with the `--bp-*` CSS custom properties.
export const BP_MOBILE_MAX = 640;
export const BP_TABLET_MAX = 1024;

export const MQ_MOBILE = `(max-width: ${BP_MOBILE_MAX}px)`;
export const MQ_TABLET = `(min-width: ${BP_MOBILE_MAX + 1}px) and (max-width: ${BP_TABLET_MAX}px)`;
export const MQ_DESKTOP = `(min-width: ${BP_TABLET_MAX + 1}px)`;
export const MQ_PORTRAIT = `(orientation: portrait)`;
export const MQ_TOUCH_PRIMARY = `(hover: none) and (pointer: coarse)`;

export function useIsMobile(): boolean {
  return useMediaQuery(MQ_MOBILE);
}
export function useIsTablet(): boolean {
  return useMediaQuery(MQ_TABLET);
}
export function useIsTouchPrimary(): boolean {
  return useMediaQuery(MQ_TOUCH_PRIMARY);
}
export function useIsPortrait(): boolean {
  return useMediaQuery(MQ_PORTRAIT);
}
