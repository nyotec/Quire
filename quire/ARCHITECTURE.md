# Architecture

Quire is built as a single-page React app whose entire runtime — including
React, all components, all CSS, and the user's notes data — is bundled into one
HTML file via Vite's `vite-plugin-singlefile`. There are no runtime requests; it
works fully offline from `file://`.

## Responsive layout (v1.4)

Three breakpoints, defined in CSS and mirrored in `src/lib/useMediaQuery.ts`:

- **Mobile** ≤ 640 px — single-column stack layout, sidebar in a slide-in
  drawer, command palette as a full-screen sheet, condensed top bar.
- **Tablet** 641 – 1024 px — sidebar narrows to 220 px; otherwise desktop.
- **Desktop** > 1024 px — full layout.

Detection is purely media-query based via `useMediaQuery` (a thin wrapper
around `window.matchMedia` that reactively updates on resize / rotate).
`useIsMobile()`, `useIsTablet()`, `useIsTouchPrimary()`, `useIsPortrait()`
are convenience hooks. The same query strings are encoded into `styles.css`
under `@media` blocks so the CSS branches match the JS branches.

Mobile-only behaviours wired in `App.tsx`:
- Wikilinks **replace** the focused leaf rather than opening alongside.
  A per-session `navHistory` array powers the top-bar back button.
- The sidebar is always rendered inside `SidebarDrawer` — controlled by
  a transient `mobileSidebarOpen` state, separate from `settings.sidebar`.
- Selecting an item in the sidebar (open leaf, today, tag, author, tasks)
  closes the drawer.

Touch-primary devices (`@media (hover: none) and (pointer: coarse)`) get
44×44 minimum tap targets; hover styles are gated by
`@media (hover: hover)` so they don't stick after a tap. Leaf bodies set
`overscroll-behavior-y: contain` to suppress pull-to-refresh.

Dynamic viewport units (`100dvh` via `--q-vh`) are used in places where
the iOS keyboard would otherwise push content off-screen, with a
`@supports (height: 100dvh)` guard for older browsers.

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

The data block is a `<script id="quire-data" type="application/json"
data-encoding="…">…</script>` in `<head>`. We rewrite it via:

```js
/(<script\s+id="quire-data"[^>]*>)[\s\S]*?(<\/script>)/
```

…replacing the matched element with a new tag whose `data-encoding` reflects
the current encoding (`lz-utf16` since v1.4; older builds wrote
`plain` or omitted the attribute). The body is the JSON, possibly compressed
with `lz-string`'s UTF-16 codec — typically 3–5× smaller than raw JSON.

On load, `loadFromHTML()` reads `data-encoding` and decompresses if needed.
Files written by v1.3 or earlier (no attribute, or `plain`) load correctly;
once saved, they're upgraded to `lz-utf16` automatically. Encrypted leaf
bodies are already high-entropy and barely compress, but the metadata
(titles, tags, settings, structure) compresses well.

**Crucially**, before
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

## Keyboard shortcuts (v1.2.1)

The first cut of Quire used `⌘N`/`⌘W`/`⌘[`/`⌘]`/`⌘⇧T` for app actions. None of
those work in real browsers — the OS or browser intercepts them before the app
sees the keydown. `⌘W` was the worst: pressing it doesn't fail to close the
leaf, it closes the **tab** (and on Tier B / Tier C, you lose unsaved IDB work
if the tab closes before the next save tick).

The current scheme avoids every Category-1 (uninterceptable) browser shortcut:

- `⌘N` (new window), `⌘T` (new tab), `⌘W` (close tab), `⌘⇧T` (reopen tab)
- `⌘L` (address bar), `⌘R` (reload), `⌘+`/`⌘-`/`⌘0` (zoom)
- `⌘[` / `⌘]` (Safari back/forward navigation)

What replaced them is in `src/lib/hotkeys.ts`. Three properties of the
implementation:

1. **Platform-aware modifier**. `isMac` is computed once at module load; on Mac
   we listen for `metaKey`, on Windows/Linux for `ctrlKey`, and we explicitly
   reject the *other* primary modifier so `Ctrl+K` on Mac does not collide with
   `Cmd+K`.
2. **Layout-independent key matching**. Bindings are keyed on `event.code`
   (`KeyJ`, `BracketLeft`, etc.), not `event.key`. This makes shortcuts work
   for Dvorak, AZERTY, German QWERTZ, and other layouts. The exception is
   `?`, which we match by `event.key === '?'` because we want the *character*
   produced (on AZERTY `?` lives on `Shift+Comma`, etc.) rather than the
   physical key position.
3. **LIFO handler stack**. `registerShortcutHandler` prepends to a list. The
   document-level `keydown` listener iterates handlers in registration order,
   so the most recently mounted modal (palette → settings drawer → help
   dialog → leaf-card edit mode) gets first dibs at consuming an action. A
   handler returns `true` to consume; anything not consumed simply passes
   through (we never call `preventDefault` for unmatched events).

`isInputFocused()` checks `document.activeElement` against `<textarea>`,
non-button `<input>`, and `contenteditable` elements. Each binding has an
`inInput` flag — `palette.open`, `wiki.save`, `settings.toggle`,
`leaf.toggleEdit`, and `esc` fire even while typing; `leaf.new`, `leaf.close`,
`leaf.move*`, `tasks.toggle`, `?`, and `Tab` do not, so they don't conflict
with regular text input.

## Privacy & encryption (v1.3)

Two layered modes: curtain (visual only) and password (real encryption).

**Curtain mode** is the default. The app renders `LockOverlay` over the main DOM
when an `ActivityMonitor` (in `src/lib/activityMonitor.ts`) detects inactivity
or hidden-tab timeout. No state changes; React doesn't unmount; on dismiss,
underlying state and scroll positions are preserved automatically. Underlying
app gets `aria-hidden` so screen readers see only the overlay.

**Password mode** encrypts each `Leaf.body` as `EncryptedField = { v, iv, ct }`
using AES-GCM (256-bit). The key is derived from the user's password via
PBKDF2-SHA256 with `iterations` calibrated per device on setup (target ~500 ms
unlock; clamped to 100k–1M). The salt and iteration count travel in the file
under `state.protection`. A *verifier* — `quire-v1-verifier` encrypted with the
key — is stored in `state.protection.verifier`; we decrypt it on unlock to
prove the password is correct without touching any leaf.

The `CryptoKey` is held in a tiny module-level ref (`cryptoKeyRef`) outside
the Zustand store so it never serializes. Decrypted leaf bodies are kept in a
`Map<LeafID, string>` (`decryptedBodyCache`) — populated lazily by the leaf
renderer via `bodyAsString(leaf)`. On lock (`ActivityMonitor` fire / manual /
broadcast / `beforeunload`), both `cryptoKeyRef` and the cache are wiped.

The boot sequence (in `App.tsx`) for password-protected files:

1. Parse the embedded `<script id="quire-data">`.
2. If `protection.mode === 'password'`, set `lockState.locked = true`
   *before* hydrate so no plaintext rendering ever happens.
3. Paint the `LockOverlay` using only the unencrypted plaintext fields:
   `lockTitle`, `lockSubtitle`, `hideIdentifyingInfo`, plus the detected
   filename and `state.lastSaved`. None of this requires the key.
4. User submits password → `verifyPassword(password, protection)` runs PBKDF2,
   tries to decrypt the verifier. On success, key is cached and lock dismisses.
5. From here on, leaves decrypt lazily as the user views them.

The IndexedDB draft store holds the same shape as the file (encrypted bodies in
password mode). No additional wrapper layer is needed — the bodies are already
ciphertext when serialized to IDB. On crash recovery, drafts decrypt only after
the user unlocks.

Cross-tab coordination: the existing `BroadcastChannel('quire:{wikiId}')` is
extended with a `lock` message. Locking in tab A broadcasts; tab B locks
itself. Each tab tracks its own activity monitor and unlocks independently.

Schema migration v2 → v3 is forward-only and adds `protection` (curtain mode
default) and `autolock` (5-minute / 30-second defaults). Existing v1.2 files
open in v1.3 with no behavior change beyond the new auto-lock.

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
