import type { Leaf, User, UserID, WikiState } from '../types';
import { LEGACY_USER_ID } from '../types';
import { LEGACY_COLOR, pickNextColor } from './userColors';
import { uuid } from './utils';

export function deriveInitials(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '··';
  const words = trimmed.split(/\s+/).filter(Boolean);
  // Non-Latin first character: use it as-is.
  const first = words[0][0];
  const isLatin = /[A-Za-z]/.test(first);
  if (!isLatin) return first;
  if (words.length >= 2) {
    const last = words[words.length - 1][0];
    return (first + last).toUpperCase().slice(0, 2);
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function makeUser(name: string, initials: string | undefined, existing: User[]): User {
  const now = new Date().toISOString();
  const cleanName = (name || '').trim() || 'Unnamed';
  const cleanInitials = (initials && initials.trim()) || deriveInitials(cleanName);
  return {
    id: uuid(),
    name: cleanName,
    initials: cleanInitials.slice(0, 3),
    color: pickNextColor(existing),
    joined: now,
    lastSeen: now,
  };
}

export function legacyUser(leaves: Leaf[]): User {
  const all = leaves.map((l) => l.created).filter(Boolean).sort();
  const allEdits = leaves.map((l) => l.edited).filter(Boolean).sort();
  return {
    id: LEGACY_USER_ID,
    name: 'Legacy author',
    initials: '··',
    color: LEGACY_COLOR,
    joined: all[0] || new Date().toISOString(),
    lastSeen: allEdits[allEdits.length - 1] || new Date().toISOString(),
  };
}

/** Apply attribution-touching to a leaf for the current user. Idempotent. */
export function touchLeaf(leaf: Leaf, currentUserId: UserID): Leaf {
  const contributors = leaf.contributors && leaf.contributors.includes(currentUserId)
    ? leaf.contributors
    : [...(leaf.contributors || []), currentUserId];
  return {
    ...leaf,
    lastEditedBy: currentUserId,
    contributors,
    edited: new Date().toISOString(),
  };
}

/** Migrate a v1 (or undefined-version) WikiState into a v2 state. */
export function migrateToV2(raw: any): WikiState {
  if (raw && raw.schemaVersion === 2 && Array.isArray(raw.users)) {
    // Already v2 — but defensive-fill any leaves that lack attribution.
    const users: User[] = raw.users;
    const fallback =
      users.find((u) => u.id === LEGACY_USER_ID) ||
      users[0] ||
      legacyUser(raw.leaves || []);
    const leaves: Leaf[] = (raw.leaves || []).map((l: Leaf) => ({
      ...l,
      authorId: l.authorId || fallback.id,
      lastEditedBy: l.lastEditedBy || l.authorId || fallback.id,
      contributors:
        Array.isArray(l.contributors) && l.contributors.length > 0
          ? l.contributors
          : [l.authorId || fallback.id],
    }));
    const usersOut = users.find((u) => u.id === fallback.id) ? users : [fallback, ...users];
    return { ...raw, leaves, users: usersOut, schemaVersion: 2 };
  }

  // v1 (or unknown) → v2 migration.
  const leaves: Leaf[] = (raw?.leaves || []).map((l: any) => ({
    ...l,
    authorId: LEGACY_USER_ID,
    lastEditedBy: LEGACY_USER_ID,
    contributors: [LEGACY_USER_ID],
  }));
  const legacy = legacyUser(leaves);
  return {
    schemaVersion: 2,
    wikiId: raw?.wikiId || uuid(),
    leaves,
    openIds: raw?.openIds || [],
    focusedId: raw?.focusedId || null,
    settings: raw?.settings,
    lastSaved: raw?.lastSaved || new Date().toISOString(),
    users: [legacy],
  } as WikiState;
}

export function leafCountsByAuthor(
  leaves: Leaf[],
  users: User[],
): { user: User; count: number }[] {
  const counts = new Map<UserID, number>();
  for (const l of leaves) {
    counts.set(l.authorId, (counts.get(l.authorId) || 0) + 1);
  }
  const userMap = new Map(users.map((u) => [u.id, u] as const));
  const out: { user: User; count: number }[] = [];
  // Include all users in the registry even if 0 leaves
  for (const u of users) {
    out.push({ user: u, count: counts.get(u.id) || 0 });
  }
  // Include any orphan authorIds (referenced but not in registry) as "unknown"
  for (const [authorId, count] of counts) {
    if (!userMap.has(authorId)) {
      out.push({
        user: {
          id: authorId,
          name: 'Unknown user',
          initials: '?',
          color: 'oklch(0.65 0.02 60)',
          joined: '',
          lastSeen: '',
        },
        count,
      });
    }
  }
  return out.sort((a, b) => b.count - a.count);
}

export function findUser(users: User[], id: UserID | null | undefined): User | null {
  if (!id) return null;
  return users.find((u) => u.id === id) || null;
}
