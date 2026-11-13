#!/usr/bin/env node
/**
 * Quire MCP server — stdio transport.
 *
 * Exposes five tools that let an AI agent read from and append notes to the
 * user's single-file Quire wikis:
 *   list_files, list_topics, search_leaves, create_leaf, create_file.
 *
 * Config is loaded fresh on each call (it's a tiny JSON file) so the user can
 * edit it without restarting. All diagnostics go to stderr; stdout is reserved
 * for the MCP protocol.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfig } from './config.js';
import type { ToolResult } from './types.js';
import { createLeaf } from './tools/createLeaf.js';
import { searchLeaves } from './tools/searchLeaves.js';
import { listFiles } from './tools/listFiles.js';
import { listTopics } from './tools/listTopics.js';
import { createFile } from './tools/createFile.js';
import { updateLeaf } from './tools/updateLeaf.js';
import { deleteLeaf } from './tools/deleteLeaf.js';

const VERSION = '1.7.0';

function log(...args: unknown[]): void {
  // stderr only — never pollute stdout (the protocol channel).
  console.error('[quire-mcp]', ...args);
}

const TOOLS = [
  {
    name: 'list_files',
    description:
      'List the Quire wiki files configured for this server, with their ' +
      'descriptions, leaf counts, and whether each is writable. Call this ' +
      'first to learn which files exist and which one is the default.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_topics',
    description:
      'List the folder structure (topics) and most-used tags of a Quire file, ' +
      'so you can route a note into an existing topic rather than inventing one.',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: 'Configured file name. Omit to use the default file.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'search_leaves',
    description:
      'Search a Quire file for existing notes (leaves) by free-text query, ' +
      'tag, and/or folder. Returns ranked matches with snippets (not full ' +
      'bodies). Use it to check for duplicates or find a note to reference.',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Configured file name. Omit for default.' },
        query: { type: 'string', description: 'Free-text search over title, body, tags.' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Only leaves carrying ALL of these tags (# optional).',
        },
        folder: { type: 'string', description: 'Restrict to this folder (name or id).' },
        limit: { type: 'number', description: 'Max results (default 20, max 100).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'create_leaf',
    description:
      'Append a new note (leaf) to a Quire file, attributed to this agent. ' +
      'The note is visibly agent-authored in Quire. Provide a markdown body. ' +
      'Optionally place it in a folder (topic) and attach source attribution ' +
      '(e.g. the Jira/email/web item it was captured from).',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Configured file name. Omit for default.' },
        title: { type: 'string', description: 'The note title.' },
        body: { type: 'string', description: 'Markdown body of the note.' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags (with or without a leading #).',
        },
        folder: {
          type: 'string',
          description:
            'Topic/folder to file under (name or id). Created top-level if ' +
            'it does not exist, unless createFolderIfMissing is false.',
        },
        createFolderIfMissing: {
          type: 'boolean',
          description: 'Create the folder if it does not exist (default true).',
        },
        pinned: { type: 'boolean', description: 'Pin the note (default false).' },
        isJournal: { type: 'boolean', description: 'Mark as a journal entry (default false).' },
        source: {
          type: 'object',
          description: 'Source attribution for a captured note.',
          properties: {
            type: { type: 'string', description: 'e.g. jira, gmail, slack, web, manual, digest.' },
            id: { type: 'string', description: 'Source identifier, e.g. "WMBT-1234".' },
            url: { type: 'string', description: 'Clickable link back to the source.' },
            title: { type: 'string', description: "The source's own title." },
            capturedAt: { type: 'string', description: 'ISO timestamp (defaults to now).' },
            capturedBy: { type: 'string', description: 'Capturing agent id (defaults to the configured name).' },
          },
          additionalProperties: false,
        },
      },
      required: ['title', 'body'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_file',
    description:
      'Create a new, empty Quire wiki file on disk (if enabled in config). The ' +
      'new file clones the app shell of an existing configured file so it ' +
      'matches your Quire version. You must add it to your config to use it by name.',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'File name within fileCreationBaseDir (".html" appended if missing).',
        },
        templateFile: {
          type: 'string',
          description: 'Configured file to clone the app shell from (defaults to the default/first readable).',
        },
      },
      required: ['filename'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_leaf',
    description:
      'Edit an existing note (leaf) by id (get ids from search_leaves). Only the ' +
      'fields you pass change; the edit is attributed to this agent. Replace the ' +
      'body with "body" or add to it with "appendBody"; move it with "folder" or ' +
      'unfile it with "removeFromFolder".',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Configured file name. Omit for default.' },
        id: { type: 'string', description: 'The leaf id to edit (from search_leaves).' },
        title: { type: 'string', description: 'New title.' },
        body: { type: 'string', description: 'Replace the whole markdown body.' },
        appendBody: { type: 'string', description: 'Append this to the existing body (alt to body).' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Replace the tags (with or without a leading #).',
        },
        folder: { type: 'string', description: 'Move the leaf to this folder (name or id).' },
        createFolderIfMissing: { type: 'boolean', description: 'Create the folder if missing (default true).' },
        removeFromFolder: { type: 'boolean', description: 'Unfile the leaf (to root).' },
        pinned: { type: 'boolean', description: 'Pin/unpin the leaf.' },
        source: {
          type: 'object',
          description: 'Set/replace source attribution.',
          properties: {
            type: { type: 'string' },
            id: { type: 'string' },
            url: { type: 'string' },
            title: { type: 'string' },
            capturedAt: { type: 'string' },
            capturedBy: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_leaf',
    description:
      'Permanently delete a note (leaf) by id. Irreversible — disabled unless ' +
      '"allowDeletion": true is set in the config. Get ids from search_leaves.',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Configured file name. Omit for default.' },
        id: { type: 'string', description: 'The leaf id to delete (from search_leaves).' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
];

async function dispatch(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  // Load config fresh each call so edits take effect without a restart.
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    const anyErr = err as { message?: string; code?: string };
    return {
      success: false,
      error: anyErr?.message ? String(anyErr.message) : String(err),
      code: anyErr?.code ?? 'CONFIG_ERROR',
    };
  }

  switch (name) {
    case 'list_files':
      return listFiles(config);
    case 'list_topics':
      return listTopics(config, args);
    case 'search_leaves':
      return searchLeaves(config, args);
    case 'create_leaf':
      return createLeaf(config, args);
    case 'create_file':
      return createFile(config, args);
    case 'update_leaf':
      return updateLeaf(config, args);
    case 'delete_leaf':
      return deleteLeaf(config, args);
    default:
      return { success: false, error: `Unknown tool "${name}".`, code: 'UNKNOWN_TOOL' };
  }
}

async function main(): Promise<void> {
  const server = new Server(
    { name: 'quire-mcp', version: VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: rawArgs } = req.params;
    const args = (rawArgs ?? {}) as Record<string, unknown>;
    let result: ToolResult;
    try {
      result = await dispatch(name, args);
    } catch (err) {
      const anyErr = err as { message?: string; code?: string };
      result = {
        success: false,
        error: anyErr?.message ? String(anyErr.message) : String(err),
        code: anyErr?.code ?? 'ERROR',
      };
    }
    if (!result.success) log(`tool ${name} failed:`, (result as { error: string }).error);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      isError: !result.success,
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log(`Quire MCP server v${VERSION} ready (stdio).`);
}

main().catch((err) => {
  log('fatal:', err);
  process.exit(1);
});
