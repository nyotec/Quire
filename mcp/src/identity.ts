/**
 * Agent User-record management.
 *
 * Every leaf an agent writes is attributed to a User with `isAgent: true`, so
 * agent-authored content is visibly agent-authored in the Quire UI (the chip
 * shows the configured icon even when author attribution is otherwise off).
 */
import { randomUUID } from 'node:crypto';
import type { WikiState, User } from './types.js';
import type { AgentIdentity } from './config.js';

export interface EnsuredAgent {
  userId: string;
  user: User;
  created: boolean;
}

/**
 * Find the agent's User record (matched by name + isAgent) or create one.
 * Keeps the icon/color in sync with the current config and bumps lastSeen.
 * Mutates `state.users` in place.
 */
export function ensureAgentUser(
  state: WikiState,
  identity: AgentIdentity,
): EnsuredAgent {
  const now = new Date().toISOString();
  const icon = identity.icon || '🤖';
  const color = identity.color || '#7c3aed';

  if (!Array.isArray(state.users)) state.users = [];

  const existing = state.users.find(
    (u) => u && u.isAgent && u.name === identity.name,
  );
  if (existing) {
    existing.lastSeen = now;
    existing.initials = icon; // the app renders this as the agent chip glyph
    existing.color = color;
    existing.isAgent = true;
    return { userId: existing.id, user: existing, created: false };
  }

  const user: User = {
    id: `agent-${randomUUID()}`,
    name: identity.name,
    initials: icon,
    color,
    joined: now,
    lastSeen: now,
    isAgent: true,
  };
  state.users.push(user);
  return { userId: user.id, user, created: true };
}
