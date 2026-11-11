# Quire — manual smoke tests

These are manual acceptance checks. Run them in a real browser against a
built `dist/quire.html` (open from `file://`). Where a test names a browser,
run it there specifically.

## v1.6.1 — save/load round-trip (the critical data-loss fix)

The v1.6 build had a bug on Microsoft Edge: auto-save grew the file on disk
but reopening read the wiki as empty. Root cause: the regex-based data-block
replacement was fragile across browsers. v1.6.1 replaces it with a
DOMParser-based replacement. These tests would have caught the bug.

### Test E1 — manual round-trip via the on-disk file

1. Open a built `quire.html`. Create a leaf titled
   `REGRESSION_TEST_E1_MARKER_xyz123`.
2. Wait for auto-save (Tier A) or hit `⌘S` (Tier B).
3. Open the saved `quire.html` in a plain text editor.
4. Find the `<script id="quire-data" ...>` block. It must carry
   `data-encoding="lz-utf16"`.
5. Run the block's contents through `LZString.decompressFromUTF16` (a
   three-line Node script, or `window.quireDebug` in another tab).
6. The decoded JSON must contain the marker title. **Pass** if present.

### Test E2 — in-app round-trip without reload

1. Open the app. Create three leaves with distinct titles.
2. Enable the debug panel (Settings → About → Show debug info).
3. In DevTools console: `await window.quireDebug.forceSave()`.
4. Then: `window.quireDebug.forceLoad()` — inspect the returned state.
5. **Pass** if the loaded state's `leaves` array contains all three titles.

### Test E3 — Edge-specific

1. Run E1 and E2 in **Edge, Chrome, Firefox, and Safari**.
2. **Pass** only if all four browsers behave identically. The original bug
   surfaced as E1/E2 passing everywhere except Edge.

### Test E4 — diagnostic logging is present

1. Open DevTools console. Reload the app. Confirm `[Quire/load]` lines
   appear (data block found, encoding, decoded length, parsed leaf count).
2. Create a leaf and save. Confirm a `[Quire/save] HTML rebuild:` line with
   a non-zero positive `delta`.
3. **Pass** if the logs are present and the delta is sensible. A zero or
   negative delta, or a `CRITICAL:` line, indicates the save is broken.

## v1.6.1 — author attribution opt-in

1. Fresh wiki (no `seed.json`). Open. No identity modal appears. Any leaf
   header reads `2h ago · #tag` with **no** author chip.
2. Settings → Author attribution → toggle on. Inline name/initials inputs
   appear. Submit `Baijnath` / `BA`. New leaves now show the `BA` chip.
3. Toggle off → chips vanish immediately. `authorId` on leaves is preserved
   (check `window.quireDebug.state()`).
4. Toggle back on → chips reappear, no re-prompt.
5. Click "Backfill attribution" → confirm → all leaves carry the chip.
6. Open a wiki that already has ≥2 non-legacy users → migration auto-enables
   attribution; chips visible immediately.

## v1.6.1 — intro card

1. Fresh seeded wiki → river shows seeded leaves; the intro card appears
   bottom-right and does NOT block interaction.
2. Click "Got it" → card slides out. Reload → card does not reappear.
3. Settings → About → "Show intro card again" → card reappears.
4. Fresh build with no `seed.json` → empty wiki → card shows the empty
   variant with "Create a note".
5. A v1.6 wiki with content but no `welcome:{wikiId}` flag → upgrade →
   open → no card; flag is set silently.

## v1.6.1 — debug panel

1. Settings → About → "Show debug info" → panel appears bottom-right with
   wiki id, leaf count, tier, encoding, browser.
2. Create leaves → the "Leaves" count updates live.
3. "Copy debug info to clipboard" → paste → plain-text block.
4. Toggle off → panel disappears; `window.quireDebug` is `undefined`.

## v1.7 — source attribution

1. Import (or hand-edit) a leaf whose data carries a `source` object, e.g.
   `{ "type": "jira", "id": "WMBT-1234", "url": "https://jira/…",
   "capturedAt": "<iso>" }`. The leaf renders a footer line below the body:
   `↗ From Jira · WMBT-1234 · captured 2h ago`.
2. With `source.url` set, the line is a link — clicking opens the URL in a new
   tab (`target="_blank"`, `rel="noopener noreferrer"`) and does **not** focus
   or toggle the leaf.
3. With no `source.url`, the same line renders as plain dim text (not a link).
4. A leaf with no `source` shows no source footer. Entering edit mode hides the
   source footer; leaving edit mode restores it.
5. `source.id` absent but `source.title` present → the middle segment shows the
   title instead of the id.

## v1.7 — agent attribution (always visible)

1. A wiki with `showAuthorAttribution: false` and a leaf authored by a user
   whose `isAgent: true` → the agent chip (🤖 or configured icon) is **still**
   shown on that leaf; human-authored leaves show no chip.
2. Hover the agent chip → tooltip reads `Created by agent: <name>`.
3. Turn `showAuthorAttribution` on → human chips appear alongside; agent chips
   unchanged.
4. A leaf created by a human and last-edited by an agent (or vice-versa) shows
   the author→editor pair with the agent side rendered as an agent chip even
   while attribution is off.

## v1.7 — external file change detection (Tier A, Chromium)

1. Open a Tier A wiki connected to `quire.html`. In another program, append a
   byte to the file (simulating an MCP write). Within ~10s a sticky toast
   appears: `🔔 This wiki was updated elsewhere · [Reload]`.
2. With no unsaved local edits, click **Reload** → the on-disk version is
   adopted; a `Reloaded the latest version from disk` toast confirms.
3. Make a local edit (status pill shows unsaved), then trigger an external
   change and click **Reload** → the merge/conflict dialog opens seeded with
   the disk version; resolving it merges as an import would.
4. With unsaved local edits, click the toast's **✕ (Dismiss)** → a confirmation
   prompt appears; cancelling keeps the toast, confirming dismisses it.
5. Saving from this tab does **not** raise the toast (own-save mtime is
   recorded within the 1s tolerance window).
6. On a browser exposing `FileSystemObserver`, the change is detected without
   waiting for the 10s poll; on others the poll path is used.

## v1.7.1 — river filters browse all matching leaves

Previously the river showed only *open* leaves and a filter merely narrowed that
open set, so with nothing open a tag/author/folder filter rendered an empty
river even while the header read "N total".

1. Open a wiki with several leaves and **nothing open** → "The river is dry."
   with a **"Show all N leaves"** button. Click it → every leaf renders; the bar
   reads `Showing all leaves · N total`.
2. Click a tag in the sidebar → the river shows **all** leaves with that tag
   (not just open ones); the bar reads `Showing leaves tagged #tag · N total`.
3. Click a person in the People list → the river shows all leaves by that author.
4. Click a folder → all leaves in it (toggle "Include sub-folders").
5. Sidebar **All notes** → shows every leaf (`Showing all leaves · N total`).
6. **clear filter** → back to the open workspace ("The river is dry." if none
   open). While a filter is active, leaf drag-reorder is disabled.

## v1.7.1 — migration preserves attribution & folders

A load-path bug reassigned every leaf to **Legacy author** and dropped the
users registry and all folders whenever a wiki at schemaVersion ≥ 3 was opened
(`migrateToV2` treated anything but exactly v2 as a v1 file). This silently
defeated multi-user attribution, agent attribution, and folders on every reload.

1. Open a wiki that has **multiple users** (or agent-authored leaves) and
   **folders**, saved at v4/v5. After load: each leaf keeps its original author
   (People list still shows every user, agent chips still render), and every
   folder and `folderId` is intact. Nothing collapses to "Legacy author".
2. A genuine **v1** file (no users registry) still gets a single *Legacy author*
   with every leaf attributed to it — unchanged.
3. Migrating the same file twice is idempotent (no author/folder drift).

## v1.7.1 — grid layout

Settings → Layout → Flow adds a third option, **grid**, alongside river/stack.

1. Pick **grid** and open "All notes" (or any filter). Leaves lay out in
   multiple columns that fill the width — more columns on a wider window, fewer
   on a narrow one, collapsing to a single column on a phone. No horizontal
   scrollbar appears at any width.
2. Every card is the same height (a uniform gallery); a long note shows a
   preview and scrolls inside its own card (all content remains reachable), and
   no card collapses to just its header.
3. Short notes stay short; switching back to river or stack is unchanged.
4. A note containing a very long unbroken URL does not widen its column or cause
   horizontal overflow.

## v1.7.1 — delete & move a leaf

Each leaf header gains a **⋯ (more)** button between Edit and Close.

1. Click **⋯** on a leaf → a menu opens with "Move to folder" (a list of all
   folders), and "Delete leaf" (in red) below a separator.
2. Pick a folder → the leaf moves there (its header breadcrumb updates; the
   folder's sidebar count increments). Re-opening the menu shows that folder
   checked/disabled and a "Remove from folder" item at the top.
3. "Remove from folder" → the leaf becomes unfiled (root).
4. With no folders yet, the menu shows "No folders yet — create one in the
   sidebar." instead of a folder list.
5. **Delete leaf** → a confirm prompt; on confirm the leaf is removed from the
   river and from the file, and the leaf/author/folder counts drop by one.
   Cancelling leaves it untouched.
6. The menu closes on outside-click or Esc, and clicking an item does not focus
   or toggle-edit the leaf behind it.

## No regressions

Re-run the headline checks from prior versions in **Edge**:

- v1.3 password mode — save & load with a master password still works.
- v1.5 folder encryption — encrypted folders survive a save/load cycle.
- v1.1 multi-user — wikis with multiple users render chips correctly.
- v1.6 schema migration — older-format JSON imports upgrade transparently.
- v1.7 schema bump — a v4 (schemaVersion 4) file opens and upgrades to 5 with
  no data loss; leaves without `source` render unchanged.
