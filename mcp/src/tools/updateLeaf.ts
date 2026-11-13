/**
 * update_leaf — edit an existing note (leaf) in a configured Quire file.
 *
 * Changes are partial: only the fields you pass are touched. The edit is
 * attributed to the agent (lastEditedBy + contributors), preserving the
 * original author. Find a leaf's id with search_leaves first.
 */
import type { QuireMcpConfig } from '../config.js';
import { resolveFile } from '../config.js';
import type { LeafSource, ToolResult } from '../types.js';
import {
  readWikiFile,
  embedState,
  writeFileAtomic,
  assertNotEncrypted,
} from '../quireFile.js';
import { ensureAgentUser } from '../identity.js';
import { resolveFolder } from '../quireState.js';
import { fail, asString, asStringArray, asBool, ToolInputError } from './shared.js';

function normalizeTag(t: string): string {
  return t.trim().replace(/^#+/, '').replace(/\s+/g, '-');
}

function buildSource(raw: unknown, agentName: string): LeafSource {
  if (typeof raw !== 'object' || raw == null) {
    throw new ToolInputError('"source" must be an object.');
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

export async function updateLeaf(
  config: QuireMcpConfig,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    const id = asString(args.id, 'id', { required: true }).trim();

    const hasTitle = args.title != null;
    const hasBody = args.body != null;
    const hasAppend = args.appendBody != null;
    const hasTags = args.tags != null;
    const hasFolder = args.folder != null;
    const removeFromFolder = asBool(args.removeFromFolder, 'removeFromFolder') ?? false;
    const hasPinned = args.pinned != null;
    const hasSource = args.source != null;

    if (hasBody && hasAppend) {
      throw new ToolInputError('Pass either "body" (replace) or "appendBody", not both.');
    }
    if (hasFolder && removeFromFolder) {
      throw new ToolInputError('Pass either "folder" or "removeFromFolder", not both.');
    }
    if (
      !hasTitle && !hasBody && !hasAppend && !hasTags && !hasFolder &&
      !removeFromFolder && !hasPinned && !hasSource
    ) {
      throw new ToolInputError('Nothing to update — pass at least one field to change.');
    }

    const { name: fileName, entry } = resolveFile(
      config,
      asString(args.file, 'file', { required: false }),
    );
    const { html, state } = await readWikiFile(entry.path);
    assertNotEncrypted(state, config.refuseEncrypted);

    const leaf = state.leaves.find((l) => l.id === id);
    if (!leaf) {
      throw new ToolInputError(`No leaf with id "${id}" in "${fileName}".`, 'LEAF_NOT_FOUND');
    }
    if (typeof leaf.body !== 'string') {
      throw new ToolInputError(`Leaf "${id}" has an encrypted body and cannot be edited.`, 'ENCRYPTED_REFUSED');
    }

    const { userId } = ensureAgentUser(state, config.agentIdentity);
    const changed: string[] = [];

    if (hasTitle) {
      leaf.title = asString(args.title, 'title').trim();
      changed.push('title');
    }
    if (hasBody) {
      leaf.body = asString(args.body, 'body');
      changed.push('body');
    }
    if (hasAppend) {
      const add = asString(args.appendBody, 'appendBody');
      const base = leaf.body as string;
      leaf.body = base && !base.endsWith('\n') ? `${base}\n${add}` : `${base}${add}`;
      changed.push('body');
    }
    if (hasTags) {
      leaf.tags = asStringArray(args.tags, 'tags').map(normalizeTag).filter(Boolean);
      changed.push('tags');
    }
    if (removeFromFolder) {
      leaf.folderId = null;
      changed.push('folder');
    } else if (hasFolder) {
      const createFolderIfMissing = asBool(args.createFolderIfMissing, 'createFolderIfMissing') ?? true;
      const info = resolveFolder(
        state,
        asString(args.folder, 'folder'),
        createFolderIfMissing,
      );
      leaf.folderId = info ? info.folderId : null;
      changed.push('folder');
    }
    if (hasPinned) {
      leaf.pinned = asBool(args.pinned, 'pinned')!;
      changed.push('pinned');
    }
    if (hasSource) {
      leaf.source = buildSource(args.source, config.agentIdentity.name);
      changed.push('source');
    }

    // Attribution: this agent is now the last editor and a contributor.
    const now = new Date().toISOString();
    leaf.edited = now;
    leaf.lastEditedBy = userId;
    leaf.contributors = Array.from(new Set([...(leaf.contributors || []), userId]));
    (state as { lastSaved: string }).lastSaved = now;

    const nextHtml = embedState(html, state);
    await writeFileAtomic(entry.path, nextHtml);

    return {
      success: true,
      file: fileName,
      leafId: leaf.id,
      title: leaf.title,
      changed,
    };
  } catch (err) {
    return fail(err);
  }
}
