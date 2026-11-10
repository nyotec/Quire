/**
 * search_leaves — find leaves in a configured file by free-text query, tag,
 * and/or folder. Ranks matches and returns compact snippets (no full bodies).
 */
import type { QuireMcpConfig } from '../config.js';
import { resolveFile } from '../config.js';
import type { Leaf, ToolResult } from '../types.js';
import { readWikiFile, assertNotEncrypted } from '../quireFile.js';
import { bodyText, folderPath } from '../quireState.js';
import { fail, asString, asStringArray, asNumber } from './shared.js';

function snippet(text: string, query: string, len = 160): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (!query) return flat.slice(0, len);
  const idx = flat.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return flat.slice(0, len);
  const start = Math.max(0, idx - 40);
  return (start > 0 ? '…' : '') + flat.slice(start, start + len).trim() + (flat.length > start + len ? '…' : '');
}

function scoreLeaf(leaf: Leaf, q: string): number {
  if (!q) return 1;
  const ql = q.toLowerCase();
  let score = 0;
  if (leaf.title.toLowerCase().includes(ql)) score += 10;
  const body = bodyText(leaf).toLowerCase();
  if (body.includes(ql)) score += 3;
  if ((leaf.tags || []).some((t) => t.toLowerCase().includes(ql))) score += 4;
  return score;
}

export async function searchLeaves(
  config: QuireMcpConfig,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    const query = asString(args.query, 'query', { required: false }).trim();
    const tags = asStringArray(args.tags, 'tags').map((t) => t.replace(/^#+/, '').toLowerCase());
    const folderRef = asString(args.folder, 'folder', { required: false }).trim();
    const limit = asNumber(args.limit, 'limit') ?? 20;

    const { name: fileName, entry } = resolveFile(config, asString(args.file, 'file', { required: false }));
    const { state } = await readWikiFile(entry.path);
    assertNotEncrypted(state, config.refuseEncrypted);

    let folderId: string | null = null;
    if (folderRef) {
      const f = state.folders.find(
        (x) => x.id === folderRef || x.name.toLowerCase() === folderRef.toLowerCase(),
      );
      if (!f) {
        return {
          success: true,
          file: fileName,
          query,
          total: 0,
          results: [],
          note: `No folder named "${folderRef}".`,
        };
      }
      folderId = f.id;
    }

    const userById = new Map(state.users.map((u) => [u.id, u] as const));

    const matches = state.leaves
      .filter((l) => (folderId ? l.folderId === folderId : true))
      .filter((l) =>
        tags.length
          ? tags.every((t) => (l.tags || []).some((lt) => lt.toLowerCase() === t))
          : true,
      )
      .map((l) => ({ leaf: l, score: scoreLeaf(l, query) }))
      .filter((m) => (query ? m.score > 0 : true))
      .sort(
        (a, b) =>
          b.score - a.score ||
          new Date(b.leaf.edited).getTime() - new Date(a.leaf.edited).getTime(),
      )
      .slice(0, Math.max(1, Math.min(limit, 100)));

    return {
      success: true,
      file: fileName,
      query,
      total: matches.length,
      results: matches.map(({ leaf }) => {
        const author = userById.get(leaf.authorId);
        return {
          id: leaf.id,
          title: leaf.title,
          tags: leaf.tags || [],
          folder: folderPath(state, leaf.folderId) || null,
          edited: leaf.edited,
          author: author ? author.name : null,
          byAgent: author ? !!author.isAgent : false,
          snippet: snippet(bodyText(leaf), query),
          source: leaf.source
            ? { type: leaf.source.type, id: leaf.source.id, url: leaf.source.url }
            : null,
        };
      }),
    };
  } catch (err) {
    return fail(err);
  }
}
