/**
 * create_file — create a brand-new, empty Quire wiki file on disk.
 *
 * A usable Quire file is the compiled app shell plus a data block. Rather than
 * bundle (and stale-pin) a copy of the app, we clone the shell from an existing
 * configured file and swap in a fresh empty state — so the new file always
 * matches the Quire version the user already runs.
 *
 * Guarded by `allowFileCreation` and confined to `fileCreationBaseDir`.
 */
import { join, resolve, sep, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import type { QuireMcpConfig } from '../config.js';
import type { ToolResult } from '../types.js';
import {
  readWikiFile,
  parseStateFromHtml,
  embedState,
  writeFileAtomic,
  QuireFileError,
} from '../quireFile.js';
import { createEmptyState } from '../quireState.js';
import { readFile } from 'node:fs/promises';
import { fail, asString } from './shared.js';
import { ToolInputError } from './shared.js';

/** Find a configured file whose HTML we can use as the app shell. */
async function findTemplateHtml(
  config: QuireMcpConfig,
  preferred?: string,
): Promise<string> {
  const order = preferred
    ? [preferred, ...Object.keys(config.files).filter((n) => n !== preferred)]
    : [
        ...Object.keys(config.files).filter((n) => config.files[n].default),
        ...Object.keys(config.files).filter((n) => !config.files[n].default),
      ];
  for (const name of order) {
    const entry = config.files[name];
    if (!entry) continue;
    try {
      const html = await readFile(entry.path, 'utf-8');
      // Validate it has a usable data block before accepting it as a shell.
      parseStateFromHtml(html);
      return html;
    } catch {
      // Empty/unreadable file — try the next one.
    }
  }
  throw new QuireFileError(
    'No readable configured Quire file to use as a template for the new wiki. ' +
      'Add at least one working Quire file to your config first.',
    'NO_TEMPLATE',
  );
}

export async function createFile(
  config: QuireMcpConfig,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    if (!config.allowFileCreation) {
      throw new ToolInputError(
        'File creation is disabled. Set "allowFileCreation": true in your config to enable it.',
        'FILE_CREATION_DISABLED',
      );
    }
    if (!config.fileCreationBaseDir) {
      throw new ToolInputError(
        'File creation needs "fileCreationBaseDir" set in your config.',
        'NO_BASE_DIR',
      );
    }

    let filename = asString(args.filename, 'filename', { required: true }).trim();
    // Confine to a bare filename within the base dir — no path traversal.
    filename = basename(filename);
    if (!filename || filename === '.' || filename === '..') {
      throw new ToolInputError('"filename" is not a valid file name.');
    }
    if (!/\.html?$/i.test(filename)) filename += '.html';

    const baseDir = config.fileCreationBaseDir;
    const target = resolve(join(baseDir, filename));
    if (target !== baseDir && !target.startsWith(baseDir + sep)) {
      throw new ToolInputError('Resolved path escapes fileCreationBaseDir.', 'PATH_ESCAPE');
    }
    if (existsSync(target)) {
      throw new ToolInputError(`A file already exists at ${target}.`, 'FILE_EXISTS');
    }

    const templateName = asString(args.templateFile, 'templateFile', { required: false }).trim();
    const shellHtml = await findTemplateHtml(config, templateName || undefined);

    const state = createEmptyState();
    const html = embedState(shellHtml, state);

    await mkdir(baseDir, { recursive: true });
    await writeFileAtomic(target, html);

    // Confirm the written file reparses cleanly.
    await readWikiFile(target).catch(() => {
      throw new QuireFileError('Wrote the file but it did not reparse — aborting.', 'VERIFY_FAILED');
    });

    return {
      success: true,
      path: target,
      wikiId: state.wikiId,
      note:
        'File created. Add it to your quire-mcp config "files" map (with a name ' +
        'and description) to read or write it by name.',
    };
  } catch (err) {
    return fail(err);
  }
}
