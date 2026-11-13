/**
 * Smoke test for update_leaf and delete_leaf, driving the tool handlers against
 * a wiki built from the real Quire app shell.
 */
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

import { createEmptyState } from '../dist/quireState.js';
import { embedState, parseStateFromHtml } from '../dist/quireFile.js';
import { createLeaf } from '../dist/tools/createLeaf.js';
import { updateLeaf } from '../dist/tools/updateLeaf.js';
import { deleteLeaf } from '../dist/tools/deleteLeaf.js';

const shellPath = join(process.cwd(), '..', 'quire', 'dist', 'quire.html');
if (!existsSync(shellPath)) {
  console.error(`Missing app shell at ${shellPath}. Build quire first.`);
  process.exit(2);
}
const shell = readFileSync(shellPath, 'utf-8');
const dir = mkdtempSync(join(tmpdir(), 'quire-ed-'));
const wikiPath = join(dir, 'work.quire.html');
writeFileSync(wikiPath, embedState(shell, createEmptyState()));

const baseConfig = {
  files: { work: { path: wikiPath, description: 'w', default: true } },
  allowFileCreation: false,
  allowDeletion: false,
  fileCreationBaseDir: undefined,
  agentIdentity: { name: 'Claude', icon: '🤖', color: '#7c3aed' },
  refuseEncrypted: true,
};

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Seed a leaf to edit.
let r = await createLeaf(baseConfig, { title: 'Original', body: 'first line', tags: ['a'] });
assert.equal(r.success, true, r.error);
const id = r.leafId;
ok('created a leaf to edit');

// update_leaf: title + appendBody + tags + move to new folder
r = await updateLeaf(baseConfig, {
  id,
  title: 'Edited title',
  appendBody: 'appended line',
  tags: ['x', '#y'],
  folder: 'Projects',
});
assert.equal(r.success, true, `update ok: ${r.error || ''}`);
assert.deepEqual([...r.changed].sort(), ['body', 'folder', 'tags', 'title']);
let state = parseStateFromHtml(readFileSync(wikiPath, 'utf-8'));
let leaf = state.leaves.find((l) => l.id === id);
assert.equal(leaf.title, 'Edited title');
assert.equal(leaf.body, 'first line\nappended line');
assert.deepEqual(leaf.tags, ['x', 'y']);
const agent = state.users.find((u) => u.isAgent);
assert.equal(leaf.lastEditedBy, agent.id);
assert.ok(leaf.contributors.includes(agent.id));
const projects = state.folders.find((f) => f.name === 'Projects');
assert.equal(leaf.folderId, projects.id);
ok('update_leaf: title/body-append/tags/move applied + attributed to agent');

// update_leaf: removeFromFolder
r = await updateLeaf(baseConfig, { id, removeFromFolder: true });
assert.equal(r.success, true);
state = parseStateFromHtml(readFileSync(wikiPath, 'utf-8'));
assert.equal(state.leaves.find((l) => l.id === id).folderId, null);
ok('update_leaf: removeFromFolder unfiles the leaf');

// update_leaf: nothing to change → error
r = await updateLeaf(baseConfig, { id });
assert.equal(r.success, false);
assert.equal(r.code, 'INVALID_ARGUMENT');
ok('update_leaf with no fields errors');

// update_leaf: unknown id → LEAF_NOT_FOUND
r = await updateLeaf(baseConfig, { id: 'nope', title: 'x' });
assert.equal(r.success, false);
assert.equal(r.code, 'LEAF_NOT_FOUND');
ok('update_leaf on unknown id → LEAF_NOT_FOUND');

// delete_leaf disabled by default
r = await deleteLeaf(baseConfig, { id });
assert.equal(r.success, false);
assert.equal(r.code, 'DELETION_DISABLED');
ok('delete_leaf refused when allowDeletion is false');

// delete_leaf enabled
const delConfig = { ...baseConfig, allowDeletion: true };
const before = parseStateFromHtml(readFileSync(wikiPath, 'utf-8')).leaves.length;
r = await deleteLeaf(delConfig, { id });
assert.equal(r.success, true, r.error);
assert.equal(r.remaining, before - 1);
state = parseStateFromHtml(readFileSync(wikiPath, 'utf-8'));
assert.equal(state.leaves.find((l) => l.id === id), undefined);
ok('delete_leaf removes the leaf when enabled');

// delete_leaf unknown id
r = await deleteLeaf(delConfig, { id: 'nope' });
assert.equal(r.success, false);
assert.equal(r.code, 'LEAF_NOT_FOUND');
ok('delete_leaf on unknown id → LEAF_NOT_FOUND');

console.log(`\nAll ${passed} checks passed.`);
