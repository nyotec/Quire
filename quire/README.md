# Quire

A single-file note-taking app. Email it, drop it on a USB stick, or open it from
`file://` and have it just work — all your data lives **inside the HTML file**.

## What it is

- One `quire.html` file. No server, no database, no external requests at runtime.
- Notes ("leaves") with `[[wikilinks]]`, `#tags`, automatic backlinks.
- Three themes (paper, ink, mono), four font pairings, two layouts (river, stack).
- Command palette (⌘K), fuzzy search, full-text body search, tag filter.
- Import/export: HTML snapshot, markdown ZIP (one .md per leaf with frontmatter), JSON.

## Building

```sh
npm install
npm run build
```

Output is a single file at `dist/quire.html`. You can email it, host it, or just
double-click it from the file manager.

## Using it

1. Open `dist/quire.html` directly in your browser.
2. **In Chromium browsers** (Chrome, Edge, Brave, Arc, Opera) — click *Connect file*
   on the onboarding card and pick a location. Every change auto-saves silently
   from then on.
3. **In Firefox/Safari** — Quire saves drafts to IndexedDB on every change. Hit
   `⌘S` (or click the *Save* button) to download the rebuilt HTML; replace your
   old `quire.html` with the new one to make changes permanent.
4. **In private/sandboxed contexts** — Quire still works, but only stores in the
   browser. Export to JSON regularly to back up.

## Browser support

| Browser | Tier | Behavior |
|---|---|---|
| Chrome, Edge, Brave, Arc, Opera | A | Silent auto-save to file (after one-time picker) |
| Firefox, Safari, mobile browsers | B | Auto-save to IndexedDB; manual download via ⌘S |
| Private mode / sandboxed iframes | C | IndexedDB only; export to back up |

The File System Access API is the difference between Tier A and Tier B; it's
[currently only shipped in Chromium-family browsers](https://caniuse.com/native-filesystem-api).

## Backups

The status pill in the top bar always shows whether your work is safe:

- 🟢 *Saved · 4s ago* — Tier A, all flushed to disk.
- 🟡 *Draft · 12 changes* — Tier B, IndexedDB up to date but file is stale; click to download.
- 🔵 *Saving…* — write in flight.
- 🔴 *Save failed · retry* — write errored; click to retry.
- ⚪ *Browser only* — Tier C, file access unavailable.

In addition to ⌘S, you can use the Settings drawer (⌘,) to:

- *Export snapshot HTML* — dated copy of the full app, never overwrites the live file.
- *Export markdown ZIP* — one `.md` per leaf with frontmatter; ideal for migrating away.
- *Export JSON* — raw state dump.

### Important `file://` caveat

IndexedDB on `file://` URLs is scoped per file path on most browsers. **Moving
`quire.html` to a new folder = new origin = empty IndexedDB at the new location.**
Drafts and the connected file handle are bound to the original location. If you
move the file, reconnect via Settings → Storage → *Connect file*.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette |
| `⌘N` / `Ctrl+N` | New leaf |
| `⌘E` / `Ctrl+E` | Toggle edit mode on the focused leaf |
| `⌘W` / `Ctrl+W` | Close focused leaf |
| `⌘[` / `⌘]` | Move focused leaf left / right |
| `⌘S` / `Ctrl+S` | Save Wiki |
| `⌘,` / `Ctrl+,` | Open settings |
| `Esc` | Close palette / settings |

Inside the palette: `>` for commands, `#` for tags, `/` for full-text body search.

## Extending

Quire is a small Vite + React + TypeScript codebase. To add features, edit and
rebuild:

- **A new theme** — add an entry to `THEMES` in `src/App.tsx` and a new option
  to `ThemeName` in `src/types.ts`.
- **A new command palette command** — add an entry to the `cmds` array in
  `src/components/CommandPalette.tsx` and handle it in `App.tsx → onPaletteCommand`.
- **A custom render hook** — extend the `renderInline` function in
  `src/lib/markdown.tsx` with a new token. The renderer returns React nodes,
  so any custom syntax can carry click handlers.
- **A new plugin** — add an entry to `DEFAULT_SETTINGS.plugins` in `src/types.ts`,
  a label in `pluginLabel()` in `src/components/SettingsDrawer.tsx`, and gate
  whatever feature it controls on `settings.plugins[id]` in `App.tsx`.

After editing, run `npm run build` to produce a new `dist/quire.html`.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md).
