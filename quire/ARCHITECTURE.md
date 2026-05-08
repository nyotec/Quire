# Architecture

Quire is built as a single-page React app whose entire runtime — including
React, all components, all CSS, and the user's notes data — is bundled into one
HTML file via Vite's `vite-plugin-singlefile`. There are no runtime requests; it
works fully offline from `file://`.

## Top-level flow

```
                ┌──────────────────────┐
   index.html → │ quire.html (single   │ ← saveToFile() rewrites the
                │ file, contains:      │   <script id="quire-data">
                │   • inlined React    │   block in place.
                │   • inlined CSS      │
                │   • <script          │
                │     id="quire-data"> │
                │     {WikiState}      │
                │     </script>        │
                └──────────────────────┘
```

## Modules

```
src/
├── main.tsx               // mounts <App />
├── App.tsx                // wires store ↔ persistence ↔ UI
├── styles.css             // entire prototype CSS, ported as-is
├── types.ts               // Leaf, WikiState, Settings, SaveStatus
├── store/
│   ├── useWikiStore.ts    // Zustand store; auto-save on every mutation
│   └── persistence.ts     // WikiPersistence class (Tier A/B/C)
├── lib/
│   ├── markdown.tsx       // small markdown → React nodes renderer
│   ├── wikilinks.ts       // buildIndex / tagCounts
│   ├── search.ts          // Fuse.js setup
│   ├── hotkeys.ts         // useGlobalHotkeys hook
│   └── utils.ts           // slug, uuid, formatRel, debounce, …
├── components/
│   ├── TopBar.tsx
│   ├── Sidebar.tsx
│   ├── LeafCard.tsx
│   ├── CommandPalette.tsx
│   ├── SettingsDrawer.tsx
│   ├── Toast.tsx
│   └── Icon.tsx
└── seed/welcome.ts        // first-run welcome leaf
```

## Boot sequence

`App` mount runs this in order:

1. **Read embedded data** — `persistence.loadFromHTML()` parses
   `<script id="quire-data" type="application/json">`. If empty/missing, we
   seed with a fresh wikiId and a single welcome leaf.
2. **Schema-migrate** — `migrateToV2()` upgrades any v1 (or unversioned) state
   in place. It synthesises a *Legacy author* user, sets every existing leaf's
   `authorId`/`lastEditedBy`/`contributors` to `legacy`, and bumps
   `schemaVersion` to 2.
3. **Open IndexedDB** (`db: quire` v2, stores: `drafts`, `handles`, `meta`,
   `identity`).
4. **Look up draft** at `draft:{wikiId}`. If `draft.lastSaved > embedded.lastSaved`,
   show the *Unsaved changes found — Restore?* modal. The user picks one.
5. **Resolve identity** — read `identity:{wikiId}` from IndexedDB. If found and
   the userId still exists in `state.users[]`, use it as `currentUserId`.
   Otherwise mark `needsIdentity = true` so the User Onboarding Modal shows
   on first paint.
6. **Hydrate the Zustand store** with the chosen state and `currentUserId`.
7. **Detect tier** (A/B/C):
   - A — `'showSaveFilePicker' in window` → silent auto-save once the user
     connects a file.
   - B — File System Access API absent → IndexedDB auto-save + manual `⌘S`
     downloads.
   - C — IndexedDB itself unavailable → browser-only banner, JSON exports only.
6. **If Tier A and a stored handle exists**, verify it via `queryPermission` /
   `requestPermission`. On any failure, downgrade to Tier B for the session and
   show an explanatory toast.
7. **Subscribe to status updates** so the top-bar pill always reflects truth.
8. **Open a `BroadcastChannel('quire:{wikiId}')`** so other tabs editing the
   same file are notified after each successful write.

## Save sequence

Every mutating store action (creating / editing / pinning / deleting a leaf,
opening / closing / reordering open leaves, changing settings) calls
`scheduleSave()`:

```
mutation → scheduleSave() → debounce 500ms (Tier A) / 400ms (Tier B)
                          ↓
                  persistence.save(state)
                          ↓
              ┌────────────┴────────────┐
              │                         │
        Tier A path                 Tier B path
              │                         │
   1. saveDraftToIDB              1. saveDraftToIDB
      (always — safety net)
   2. acquire mutex
      (isWriting = true,
       coalesce with pendingState)
   3. rebuildHTML(state):
      - serialize state as JSON,
        escaping `</` to `<\/`
      - prepend `<!DOCTYPE html>\n`
      - regex-replace the
        <script id="quire-data">
        block in place
   4. handle.createWritable()
      .write(html).close()
   5. on success: notify('saved')
      broadcast('updated')
      clear pendingChanges
   6. if pendingState != null,
      tail-call saveTierA(pendingState)
```

The mutex (`isWriting` flag + `pendingState` slot) prevents two concurrent
writes from racing — at most one writable is open against the file at a time;
late mutations fold into a single follow-up write.

`⌘S` (or the *Save Wiki* button / status pill click when dirty) calls
`doManualSave`. In Tier A this just nudges `persistence.save`. In Tier B it
calls `persistence.manualDownload`, which rebuilds the HTML and triggers a
`Blob` + `<a download>` download.

## The data block

The data block is a `<script id="quire-data" type="application/json">…</script>`
in `<head>`. We rewrite it via:

```js
/(<script\s+id="quire-data"[^>]*>)[\s\S]*?(<\/script>)/
```

…replacing the captured contents with the new JSON. **Crucially**, before
inserting the JSON we replace `</` with `<\/` so any user-authored
`</script>` text inside a leaf body cannot terminate the script tag early.

## IndexedDB layout

| Store | Key | Value |
|---|---|---|
| `drafts` | `draft:{wikiId}` | `{ state: WikiState, lastSaved: ISO }` |
| `handles` | `fileHandle:{wikiId}` | `FileSystemFileHandle` (structured-cloned) |
| `identity` | `identity:{wikiId}` | `{ wikiId, currentUserId }` |
| `meta` | (reserved for future) | — |

The IDB schema version is **2**. The upgrade path creates `drafts`/`handles`/`meta`
on first install (or `oldVersion < 1`) and adds `identity` on `oldVersion < 2`.
Existing data in `drafts`/`handles` is preserved across the upgrade.

Handles are **structured-clonable** in modern Chromium — they serialize into
IndexedDB directly. We never `JSON.stringify` them.

## Cross-tab coordination

Each tab opens `BroadcastChannel('quire:{wikiId}')` on boot. After a successful
write, the writing tab posts `{ type: 'updated' }`; receiving tabs surface a
"This file was updated in another tab — Reload" toast. Reloading re-reads the
embedded block, which is now the most recent saved state.

When a user updates their own profile (name/initials/color), the channel also
posts `{ type: 'userUpdated', userId }` so other tabs can refresh affected
chips without a full reload.

## Tasks (v1.2)

Tasks are not a separate noun in the data model. They are a *property of lines*
inside leaves. A task's identity is the pair `(leafId, lineNumber)`.

- The markdown renderer parses task lines (`- [ ] …`, `- [x] …`) and attaches
  the source line index to each rendered checkbox button.
- Clicking a checkbox in render mode calls `toggleTaskOnLine(body, line)` from
  `src/lib/tasks.ts`, which finds the exact line via regex, flips the bracket,
  and returns the new body. The leaf is then updated through the existing
  `updateLeaf` action — same path as any other edit, including the v1.1
  attribution bookkeeping (`lastEditedBy`, `contributors`).
- The Tasks view (`src/components/TasksView.tsx`) is a *virtual leaf* — same
  visual chrome as a real card, but it is not in `openIds` and has no entry in
  `state.leaves`. It lives in app-local UI state (`tasksOpen`, `tasksFocused`)
  and renders in the river ahead of real leaves while open.
- The task list shown in TasksView is derived: `allTasks(leaves)` flat-maps
  `extractTasks` over every leaf on every render. This is fast enough for tens
  of thousands of leaves; if it ever isn't, memoise per-leaf with a `WeakMap`.
- Due dates use the syntax `@YYYY-MM-DD`. They render as `DueChip` only when
  the renderer is processing task text (not paragraphs), guarded by the
  `isTaskText` flag passed into `renderInline`.
- Code blocks are skipped during task extraction (the `inFence` flag in
  `extractTasks`) so a `- [ ]` inside a fenced code sample isn't picked up.
- Settings.tasks (`{ showOverdueBadge, dateFormat }`) is migrated on hydrate
  by merging defaults if absent — older v1.1 files load cleanly into v1.2.

## User identity (v1.1)

`WikiState` carries a `users: User[]` registry. Each `User` has a stable
`id` (uuid), display `name`, derived `initials`, a `color` from an 8-entry
palette, plus `joined`/`lastSeen` timestamps. Every `Leaf` has `authorId`
(creator), `lastEditedBy` (most recent saver), and `contributors` (everyone
who has ever touched the leaf).

`currentUserId` lives in IndexedDB only — never in `WikiState`. This is the key
design decision: the wiki state (which gets serialised into the HTML and shared)
contains the registry of *all* users, but not "who is using this browser." When
the file moves to a new device, that device's user identifies themselves; the
existing `users` registry is appended to, never overwritten.

Every leaf mutation runs through `touchLeaf(leaf, currentUserId)`, which
updates `lastEditedBy`, appends to `contributors` if absent, and bumps
`edited`. New leaves seed `authorId = lastEditedBy = currentUserId` and
`contributors = [currentUserId]`.

## Why no `localStorage`

`localStorage` is synchronous, capped at ~5MB, and aggressively cleared on
quota pressure. Wiki state — even small ones — easily exceeds that. We use it
only for tiny UI state (the onboarding-dismissed flag) and even that is stored
in the Zustand-persisted state instead, so it travels with the file.

## Performance notes

- The file size is monitored via `persistence.buildHTML(state).length` after
  each hydrated mutation. Crossing 10MB triggers a one-time toast warning.
- `outerHTML` rebuild starts to be measurable around ~5MB. The 400/500ms
  debounce + the mutex keep it from running more than once per quiet pause.
- Markdown rendering uses `useMemo` over `(exists, onWikilink, onTag)` per
  leaf; backlinks are computed once via `useMemo(buildIndex(leaves), [leaves])`
  shared across the whole tree.

## What "single-file" buys you

- **Portability**: email it, AirDrop it, drop it on a USB stick. It's just an
  HTML file.
- **Privacy**: no requests leave your machine. The `<script>`s are local; the
  data is local; the renderer is local.
- **Versioning**: copy the file to make a backup. Keep dated copies via
  *Export snapshot HTML*.
- **Forkability**: you can read the source by opening the file in a text editor.
  Plugins/themes can be added by hand-editing if you ever need to.
