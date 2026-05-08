import type { User } from '../types';

export const USER_COLORS = [
  'oklch(0.62 0.12 70)',
  'oklch(0.58 0.08 150)',
  'oklch(0.55 0.12 280)',
  'oklch(0.55 0.14 30)',
  'oklch(0.5  0.12 330)',
  'oklch(0.6  0.13 200)',
  'oklch(0.65 0.11 110)',
  'oklch(0.55 0.13 0)',
];

export const LEGACY_COLOR = 'oklch(0.65 0.02 80)';

export function pickNextColor(existing: User[]): string {
  const used = new Set(existing.map((u) => u.color));
  for (const c of USER_COLORS) {
    if (!used.has(c)) return c;
  }
  return USER_COLORS[existing.length % USER_COLORS.length];
}
