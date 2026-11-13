/**
 * delete_leaf — permanently remove a note (leaf) from a configured Quire file.
 *
 * Destructive and irreversible, so it is gated behind `allowDeletion: true` in
 * the config. Find a leaf's id with search_leaves first.
 */
import type { QuireMcpConfig } from '../config.js';
import { resolveFile } from '../config.js';
import type { ToolResult } from '../types.js';
import {
  readWikiFile,
  embedState,
  writeFileAtomic,
  assertNotEncrypted,
} from '../quireFile.js';
import { fail, asString, ToolInputError } from './shared.js';

export async function deleteLeaf(
  config: QuireMcpConfig,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    if (!config.allowDeletion) {
      throw new ToolInputError(
        'Deletion is disabled. Set "allowDeletion": true in your config to enable delete_leaf.',
        'DELETION_DISABLED',
      );
    }
    const id = asString(args.id, 'id', { required: true }).trim();

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
    const deletedTitle = leaf.title;

    state.leaves = state.leaves.filter((l) => l.id !== id);
    if (Array.isArray(state.openIds)) {
      state.openIds = state.openIds.filter((x) => x !== id);
    }
    if (state.focusedId === id) state.focusedId = null;
    (state as { lastSaved: string }).lastSaved = new Date().toISOString();

    const nextHtml = embedState(html, state);
    await writeFileAtomic(entry.path, nextHtml);

    return {
      success: true,
      file: fileName,
      deletedLeafId: id,
      title: deletedTitle,
      remaining: state.leaves.length,
    };
  } catch (err) {
    return fail(err);
  }
}
