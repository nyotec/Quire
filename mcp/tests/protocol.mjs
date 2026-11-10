/**
 * Protocol-level check: start the server over stdio via the MCP SDK client,
 * initialize, list tools, and call list_files. Proves the server speaks MCP.
 */
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createEmptyState } from '../dist/quireState.js';
import { embedState } from '../dist/quireFile.js';

const shellPath = join(process.cwd(), '..', 'quire', 'dist', 'quire.html');
if (!existsSync(shellPath)) {
  console.error(`Missing app shell at ${shellPath}. Build quire first.`);
  process.exit(2);
}
const shellHtml = readFileSync(shellPath, 'utf-8');
const dir = mkdtempSync(join(tmpdir(), 'quire-mcp-proto-'));
const wikiPath = join(dir, 'work.quire.html');
const cfgPath = join(dir, 'config.json');
writeFileSync(wikiPath, embedState(shellHtml, createEmptyState()));
writeFileSync(
  cfgPath,
  JSON.stringify({
    files: { work: { path: wikiPath, description: 'w', default: true } },
    agentIdentity: { name: 'Claude' },
    refuseEncrypted: true,
  }),
);

const transport = new StdioClientTransport({
  command: 'node',
  args: [join(process.cwd(), 'dist', 'index.js')],
  env: { ...process.env, QUIRE_MCP_CONFIG: cfgPath },
});
const client = new Client({ name: 'smoke-client', version: '1.0.0' }, { capabilities: {} });
await client.connect(transport);

const tools = await client.listTools();
const names = tools.tools.map((t) => t.name).sort();
assert.deepEqual(names, [
  'create_file',
  'create_leaf',
  'list_files',
  'list_topics',
  'search_leaves',
]);
console.log('  ✓ tools/list returns all five tools');

const res = await client.callTool({ name: 'list_files', arguments: {} });
const payload = JSON.parse(res.content[0].text);
assert.equal(payload.success, true);
assert.equal(payload.defaultFile, 'work');
console.log('  ✓ tools/call list_files succeeds over the protocol');

const bad = await client.callTool({ name: 'create_leaf', arguments: { body: 'no title' } });
const badPayload = JSON.parse(bad.content[0].text);
assert.equal(badPayload.success, false);
assert.equal(bad.isError, true);
console.log('  ✓ missing required arg returns an isError envelope');

await client.close();
console.log('\nProtocol check passed.');
