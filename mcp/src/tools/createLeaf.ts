/**
 * create_leaf — append a new note (leaf) to a configured Quire file,
 * attributed to the agent's User record.
 */
import { randomUUID } from 'node:crypto';
import type { QuireMcpConfig } from '../config.js';
import { resolveFile } from '../config.js';
import type { Leaf, LeafSource, ToolResult, WikiState } from '../types.js';
import {
  readWikiFile,
  embedState,
  writeFileAtomic,
  assertNotEncrypted,
} from '../quireFile.js';
import { ensureAgentUser } from '../identity.js';
import { resolveFolder } from '../quireState.js';
import { fail, asString, asStringArray, asBool } from './shared.js';

function normalizeTag(t: string): string {
  return t.trim().replace(/^#+/, '').replace(/\s+/g, '-');
}

function buildSource(
  raw: unknown,
  agentName: string,
): LeafSource | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== 'object') {
    throw new Error('"source" must be an object.');
  }
  const s = raw as Record<string, unknown>;
  const type = typeof s.type === 'string' && s.type.trim() ? s.type.trim() : 'manual';
  const src: LeafSource = {
    type,
    capturedAt:
      typeof s.capturedAt === 'string' && s.capturedAt.trim()
        ? s.capturedAt
        : new Date().toISOString(),
    capturedBy:
      typeof s.capturedBy === 'string' && s.capturedBy.trim()
        ? s.capturedBy.trim()
        : agentName,
  };
  if (typeof s.id === 'string' && s.id.trim()) src.id = s.id.trim();
  if (typeof s.url === 'string' && s.url.trim()) src.url = s.url.trim();
  if (typeof s.title === 'string' && s.title.trim()) src.title = s.title.trim();
  return src;
}

export async function createLeaf(
  config: QuireMcpConfig,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    const title = asString(args.title, 'title', { required: true }).trim();
    const body = asString(args.body, 'body', { required: true });
    const tags = asStringArray(args.tags, 'tags').map(normalizeTag).filter(Boolean);
    const pinned = asBool(args.pinned, 'pinned') ?? false;
    const isJournal = asBool(args.isJournal, 'isJournal') ?? false;
    const createFolderIfMissing = asBool(args.createFolderIfMissing, 'createFolderIfMissing') ?? true;
    const folderRef = asString(args.folder, 'folder', { required: false });

    const { name: fileName, entry } = resolveFile(config, asString(args.file, 'file', { required: false }));
    const { html, state } = await readWikiFile(entry.path);
    assertNotEncrypted(state, config.refuseEncrypted);

    const { userId, created: agentCreated } = ensureAgentUser(state, config.agentIdentity);

    let folderInfo: { folderId: string; created: boolean } | null = null;
    if (folderRef) {
      folderInfo = resolveFolder(state, folderRef, createFolderIfMissing);
    }

    const source = buildSource(args.source, config.agentIdentity.name);
    const now = new Date().toISOString();
    const leaf: Leaf = {
      id: `leaf-${randomUUID()}`,
      title,
      body,
      tags,
      pinned,
      isJournal,
      created: now,
      edited: now,
      authorId: userId,
      lastEditedBy: userId,
      contributors: [userId],
      folderId: folderInfo ? folderInfo.folderId : null,
      ...(source ? { source } : {}),
    };

    state.leaves.push(leaf);
    (state as WikiState).lastSaved = now;

    const nextHtml = embedState(html, state);
    await writeFileAtomic(entry.path, nextHtml);

    return {
      success: true,
      file: fileName,
      leafId: leaf.id,
      title: leaf.title,
      tags: leaf.tags,
      folder: folderInfo
        ? { id: folderInfo.folderId, created: folderInfo.created }
        : null,
      agentUserId: userId,
      agentUserCreated: agentCreated,
      hasSource: !!source,
    };
  } catch (err) {
    return fail(err);
  }
}
