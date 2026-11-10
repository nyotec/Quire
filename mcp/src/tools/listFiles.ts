/**
 * list_files — enumerate the configured Quire files with their descriptions
 * and a quick readability/stat probe, so the agent knows where it can write.
 */
import type { QuireMcpConfig } from '../config.js';
import type { ToolResult } from '../types.js';
import { readWikiFile, detectEncryption } from '../quireFile.js';
import { fail } from './shared.js';

export async function listFiles(config: QuireMcpConfig): Promise<ToolResult> {
  try {
    const files = await Promise.all(
      Object.entries(config.files).map(async ([name, entry]) => {
        const base = {
          name,
          path: entry.path,
          description: entry.description ?? null,
          default: !!entry.default,
        };
        try {
          const { state } = await readWikiFile(entry.path);
          const encryptedReason = detectEncryption(state);
          return {
            ...base,
            readable: true,
            leafCount: state.leaves.length,
            folderCount: (state.folders || []).length,
            encrypted: !!encryptedReason,
            encryptedReason: encryptedReason,
            writable: !(config.refuseEncrypted && encryptedReason),
          };
        } catch (err) {
          const anyErr = err as { message?: string; code?: string };
          return {
            ...base,
            readable: false,
            reason: anyErr?.message ? String(anyErr.message) : String(err),
            code: anyErr?.code ?? 'ERROR',
          };
        }
      }),
    );

    return {
      success: true,
      defaultFile:
        Object.keys(config.files).find((n) => config.files[n].default) ??
        (Object.keys(config.files).length === 1
          ? Object.keys(config.files)[0]
          : null),
      files,
    };
  } catch (err) {
    return fail(err);
  }
}
