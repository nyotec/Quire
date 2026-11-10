/**
 * Integration smoke test for the Quire MCP server.
 *
 * Exercises the real tool pipeline against a wiki built from the actual Quire
 * app shell (quire/dist/quire.html), then verifies the written file reparses
 * and round-trips through lz-string exactly as the browser app would read it.
 *
 * Run:  node tests/smoke.mjs   (after `npm run build` in mcp/, and a built
 *                               quire/dist/quire.html to use as the shell)
 */
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

import { createEmptyState } from '../dist/quireState.js';
import { embedState, parseStateFromHtml } from '../dist/quireFile.js';

let shellPath = join(process.cwd(), '..', 'quire', 'dist', 'quire.html');
if (!existsSync(shellPath)) {
  console.error(`Missing app shell at ${shellPath}. Build quire first: (cd ../quire && npm run build)`);
  process.exit(2);
}
const shellHtml = readFileSync(shellPath, 'utf-8');

const dir = mkdtempSync(join(tmpdir(), 'quire-mcp-test-'));
const wikiPath = join(dir, 'work.quire.html');
const encPath = join(dir, 'locked.quire.html');
const cfgPath = join(dir, 'config.json');

// A fresh empty wiki written through the real embed path.
writeFileSync(wikiPath, embedState(shellHtml, createEmptyState()));

// An encrypted wiki (master password) to prove refusal.
const enc = createEmptyState();
enc.protection = { mode: 'password', salt: 'x', iterations: 1, hash: 'SHA-256' };
writeFileSync(encPath, embedState(shellHtml, enc));

writeFileSync(
  cfgPath,
  JSON.stringify({
    files: {
      work: { path: wikiPath, description: 'Test work wiki', default: true },
      locked: { path: encPath, description: 'Encrypted wiki' },
    },
    allowFileCreation: true,
    fileCreationBaseDir: dir,
    agentIdentity: { name: 'Claude', icon: '🤖', color: '#7c3aed' },
    refuseEncrypted: true,
  }),
);
process.env.QUIRE_MCP_CONFIG = cfgPath;

// Import tool handlers AFTER setting the config env.
const { loadConfig } = await import('../dist/config.js');
const { listFiles } = await import('../dist/tools/listFiles.js');
const { listTopics } = await import('../dist/tools/listTopics.js');
const { createLeaf } = await import('../dist/tools/createLeaf.js');
const { searchLeaves } = await import('../dist/tools/searchLeaves.js');
const { createFile } = await import('../dist/tools/createFile.js');

const config = loadConfig();
let passed = 0;
const ok = (label) => {
  passed++;
  console.log('  ✓', label);
};

// 1. list_files
let r = await listFiles(config);
assert.equal(r.success, true, 'list_files ok');
assert.equal(r.defaultFile, 'work');
const work = r.files.find((f) => f.name === 'work');
assert.equal(work.readable, true);
assert.equal(work.leafCount, 0);
assert.equal(work.writable, true);
const locked = r.files.find((f) => f.name === 'locked');
assert.equal(locked.encrypted, true);
assert.equal(locked.writable, false);
ok('list_files reports readable/encrypted/default correctly');

// 2. list_topics on an empty wiki
r = await listTopics(config, {});
assert.equal(r.success, true);
assert.deepEqual(r.folders, []);
assert.deepEqual(r.tags, []);
ok('list_topics on empty wiki returns no folders/tags');

// 3. create_leaf with folder + source + tags
r = await createLeaf(config, {
  title: 'Ship v1.7',
  body: 'Cut the release once CI is green.\n\n- [ ] tag build',
  tags: ['#release', 'quire'],
  folder: 'Projects',
  source: { type: 'jira', id: 'WMBT-1234', url: 'https://example.com/WMBT-1234' },
});
assert.equal(r.success, true, `create_leaf ok: ${r.error || ''}`);
assert.ok(r.leafId.startsWith('leaf-'));
assert.equal(r.folder.created, true);
assert.equal(r.agentUserCreated, true);
assert.equal(r.hasSource, true);
assert.deepEqual(r.tags, ['release', 'quire']);
ok('create_leaf appends with normalized tags, new folder, agent user, source');

// 3b. Second leaf reuses the agent user and the existing folder.
r = await createLeaf(config, {
  title: 'Standup notes',
  body: 'Discussed the release plan.',
  folder: 'Projects',
  tags: ['notes'],
});
assert.equal(r.success, true);
assert.equal(r.agentUserCreated, false, 'agent user reused');
assert.equal(r.folder.created, false, 'folder reused');
ok('create_leaf reuses agent user and existing folder');

// 4. Verify the file reparses and round-trips as the app would read it.
const reparsed = parseStateFromHtml(readFileSync(wikiPath, 'utf-8'));
assert.equal(reparsed.leaves.length, 2);
assert.equal(reparsed.schemaVersion, 5);
const agent = reparsed.users.find((u) => u.isAgent);
assert.ok(agent, 'agent user persisted');
assert.equal(agent.initials, '🤖');
assert.equal(reparsed.leaves[0].authorId, agent.id);
assert.equal(reparsed.leaves[0].source.type, 'jira');
ok('written file reparses: 2 leaves, schema 5, agent-authored, source intact');

// 5. list_topics now shows the folder and tags
r = await listTopics(config, {});
assert.equal(r.folders.length, 1);
assert.equal(r.folders[0].name, 'Projects');
assert.equal(r.folders[0].leafCount, 2);
assert.ok(r.tags.some((t) => t.tag === 'release'));
ok('list_topics reflects new folder and tags');

// 6. search_leaves
r = await searchLeaves(config, { query: 'release' });
assert.equal(r.success, true);
assert.ok(r.total >= 1);
assert.ok(r.results[0].byAgent, 'result flagged agent-authored');
ok('search_leaves finds the note and flags agent authorship');

r = await searchLeaves(config, { tags: ['notes'] });
assert.equal(r.total, 1);
assert.equal(r.results[0].title, 'Standup notes');
ok('search_leaves filters by tag');

// 7. Encryption refusal on read + write
r = await createLeaf(config, { file: 'locked', title: 'x', body: 'y' });
assert.equal(r.success, false);
assert.equal(r.code, 'ENCRYPTED_REFUSED');
ok('create_leaf refuses an encrypted wiki (ENCRYPTED_REFUSED)');

r = await listTopics(config, { file: 'locked' });
assert.equal(r.success, false);
assert.equal(r.code, 'ENCRYPTED_REFUSED');
ok('list_topics refuses an encrypted wiki');

// 8. create_file
r = await createFile(config, { filename: 'fresh-notes' });
assert.equal(r.success, true, `create_file ok: ${r.error || ''}`);
assert.ok(r.path.endsWith('fresh-notes.html'));
const freshState = parseStateFromHtml(readFileSync(r.path, 'utf-8'));
assert.equal(freshState.leaves.length, 0);
assert.equal(freshState.schemaVersion, 5);
ok('create_file produces a fresh, reparseable empty wiki');

// 8b. create_file rejects traversal
r = await createFile(config, { filename: '../escape.html' });
// basename() strips the traversal, so it writes escape.html inside baseDir — success, confined.
assert.equal(r.success, true);
assert.ok(r.path.startsWith(dir), 'confined to base dir');
ok('create_file confines filenames to the base dir');

// 9. Unknown file error shape
r = await listTopics(config, { file: 'nope' });
assert.equal(r.success, false);
assert.equal(r.code, 'CONFIG_ERROR');
ok('unknown file yields a CONFIG_ERROR envelope');

console.log(`\nAll ${passed} checks passed.`);
