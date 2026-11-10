/**
 * list_topics — the folder structure and top tags of a file (or the default),
 * so an agent can route a note to an existing topic instead of inventing one.
 */
import type { QuireMcpConfig } from '../config.js';
import { resolveFile } from '../config.js';
import type { ToolResult } from '../types.js';
import { readWikiFile, assertNotEncrypted } from '../quireFile.js';
import { summarizeFolders, collectTags } from '../quireState.js';
import { fail, asString } from './shared.js';

export async function listTopics(
  config: QuireMcpConfig,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    const { name: fileName, entry } = resolveFile(
      config,
      asString(args.file, 'file', { required: false }),
    );
    const { state } = await readWikiFile(entry.path);
    assertNotEncrypted(state, config.refuseEncrypted);

    return {
      success: true,
      file: fileName,
      leafCount: state.leaves.length,
      folders: summarizeFolders(state),
      tags: collectTags(state),
    };
  } catch (err) {
    return fail(err);
  }
}
