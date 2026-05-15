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

## No regressions

Re-run the headline checks from prior versions in **Edge**:

- v1.3 password mode — save & load with a master password still works.
- v1.5 folder encryption — encrypted folders survive a save/load cycle.
- v1.1 multi-user — wikis with multiple users render chips correctly.
- v1.6 schema migration — older-format JSON imports upgrade transparently.
