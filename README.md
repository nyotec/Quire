# Quire

> A single-file note-taking app. Your entire wiki — app and data — lives inside one HTML file you can email, AirDrop, or carry on a USB stick.

## What it is

Quire is a personal wiki bundled into one self-contained HTML file. Open it in any modern browser — Chrome, Firefox, Safari, Edge — and the whole notebook runs locally: rendering, search, encryption, persistence. There is no server, no database, no account, no telemetry. The file *is* the wiki.

The design rests on a small set of stubborn ideas: markdown is the canonical store; the file is the unit of portability; one file should work for one person, then for a small group, then for the same person across two devices, with diminishing returns past that. Quire is not a Notion replacement. It is a TiddlyWiki successor with modern conveniences — wikilinks, backlinks, tasks with due dates, a command palette, optional encryption, multi-user attribution — and the same uncompromising single-file footprint.

## Quick start

```sh
# 1. Get a build (or download dist/quire.html from a GitHub Release)
git clone https://github.com/nyotec/Quire.git
cd Quire/quire
npm install
npm run build

# 2. Open it
open dist/quire.html      # macOS
xdg-open dist/quire.html  # Linux
start dist/quire.html     # Windows
```

That's it. The file is now your wiki. Press `⌘N` (or `Ctrl+N` placeholder if your build pre-dates v1.2.1, otherwise `⌘J`) and start writing.

## Features

Every feature shipped to date, organised by what you'd reach for it for.

### Writing & organising

#### Markdown editing with live render

Each leaf is a markdown document. Edit mode shows a textarea; render mode shows the parsed result. Toggle with `⌘Return`. Headings, hr, fenced code, blockquote, mixed bullet/task lists, tables, bold/italic/inline-code, external links — all work.

**How to use it**: focus a leaf, press `⌘Return`, type, press `⌘Return` again to leave edit mode.

**Available since**: v1

**Notes & limits**: the renderer is a small purpose-built parser, not CommonMark-strict. It returns React/Preact nodes (not HTML strings) so wikilinks and tags carry click handlers.

#### Wikilinks

Wrap any phrase in double brackets to link to another leaf: `[[Like this]]`. Clicking opens that leaf in the river beside the current one (or, on mobile, replaces it with a back-history fallback). If the target leaf doesn't exist yet, the link renders dim and dashed; clicking it creates the leaf with that title.

**How to use it**: type `[[Title of another note]]` anywhere in a leaf body.

**Available since**: v1

#### Tags

Inline `#tag` syntax. Tags are extracted from leaf bodies on every save and shown in the sidebar's Tags section with counts.

**How to use it**: write `#somelabel` in a leaf. Click the tag in the sidebar to filter the river to leaves with that tag.

**Available since**: v1

**Notes & limits**: tag character set is `[a-zA-Z][\w/-]*` so `#book/deutsch` works for hierarchical tagging.

#### Backlinks

When a leaf is focused, the river card shows a footer listing every other leaf that wikilinks *to* this one, with a 120-character snippet of the sentence containing the link. Click a backlink to open the source leaf.

**How to use it**: focus any leaf to see its backlinks (if any) at the bottom of the card.

**Available since**: v1

#### Tag filter

Click any tag pill (in the sidebar or in a leaf header) to filter the river. A filter bar at the top of the river lets you clear it.

**Available since**: v1

#### Author filter

Click any author chip (in the leaf header, the People sidebar, or the backlinks footer) to filter the river to leaves by that user.

**Available since**: v1.1

#### Pinned leaves

Click the pin icon on a leaf header to surface it in the sidebar's Pinned section.

**Available since**: v1

#### Journal leaves

Special-cased leaves marked `isJournal: true` get a coloured spine and are surfaced via the sidebar's "Today's journal" button.

**Available since**: v1

#### Tasks (`- [ ]`)

Markdown-style task syntax. In render mode, click any checkbox to toggle. The underlying markdown is edited surgically — only that line, only the bracket — so whitespace, indentation, and surrounding content are preserved.

**How to use it**: write `- [ ] do the thing` on its own line. In render mode, click the box.

**Available since**: v1.2

#### Due dates (`@YYYY-MM-DD`)

Append `@YYYY-MM-DD` to any task line. Renders as a chip with status colouring: red for overdue, accent for today, dim for future, struck-through when the task is complete.

**How to use it**: `- [ ] Reply to Marcus @2026-05-15`. Format defaults to relative ("today", "in 3d", "May 15"); switch to absolute or both in Settings → Tasks.

**Available since**: v1.2

### Working with multiple notes

#### The river layout

A horizontal scroll of open leaves, all visible at once. The default layout on desktop. Drag-to-reorder via the handle at the left of each card. `⌘⇧[` / `⌘⇧]` move the focused leaf left/right.

**Available since**: v1

#### The stack layout

A vertical column of open leaves, one above the next. Useful when you want to scroll through several leaves linearly, like a long document. Toggle in Settings → Layout.

**Available since**: v1

#### Tasks aggregation view

A virtual leaf showing every task across every leaf, with filters (open/done/all), a "due-date only" toggle, and three sort orders (due / created / by-leaf). Source-leaf indicator on each row opens the source leaf alongside the Tasks view.

**How to use it**: `⌘⇧K` or click the Tasks row at the top of the sidebar.

**Available since**: v1.2

**Notes & limits**: the Tasks view is a derived projection — it does not own any state. Toggling a checkbox in the Tasks view edits the source leaf's markdown directly.

### Finding & navigating

#### Command palette

Open with `⌘K` from anywhere. Five modes:

- *(no prefix)* — fuzzy find by title (Fuse.js)
- `>` — commands (theme switches, layout switches, save, exports, settings)
- `#` — find leaves by tag
- `@` — find by author (lists users; typing filters by name)
- `!` — find by task text
- `/` — full-text body search

Arrow keys navigate, Enter activates, Esc closes.

**Available since**: v1; modes added through v1.2

### Saving & sharing

#### Tier A — silent auto-save (Chromium)

On Chrome / Edge / Brave / Arc / Opera, the File System Access API lets Quire write directly to a chosen file. After a one-time picker (the onboarding card), every change is saved silently, debounced at 500ms, with a write mutex so concurrent writes can't corrupt the file.

**Available since**: v1

#### Tier B — IndexedDB auto-save + manual file save (Firefox, Safari)

When the File System Access API is unavailable, Quire auto-saves a draft to IndexedDB on every change (400ms debounce). Hit `⌘S` to download the rebuilt HTML. Replace your old file with the download to make changes durable across browsers.

**Available since**: v1

#### Tier C — IndexedDB-only (private mode / sandboxed)

In contexts where neither file API works, Quire still works locally via IndexedDB. Export to JSON regularly to back up.

**Available since**: v1

#### Markdown export (ZIP)

Settings → Storage → "Export markdown ZIP". One `.md` file per leaf with frontmatter (id, title, tags, timestamps, author).

**Available since**: v1

#### JSON export

Plain dump of the full state. Useful for backups, scripts, mass edits.

**Available since**: v1

#### Cross-tab coordination

If you open the same file in two browser tabs, edits in tab A are surfaced as a "this file was updated in another tab — Reload" toast in tab B (via `BroadcastChannel`).

**Available since**: v1

### Privacy & access control

#### Curtain mode auto-lock

After configurable inactivity (default 5 min), or after the tab has been hidden for 30 seconds, a full-screen overlay covers the app. Press any key to dismiss. **Visual hiding only — not encryption.**

**How to use it**: enabled by default. Configure timeouts in Settings → Privacy. Manually lock with `⌘;` or the lock button in the top bar.

**Available since**: v1.3

#### Password mode encryption

Encrypts every leaf body with AES-GCM (256-bit), key derived from your password via PBKDF2-SHA256 (calibrated per device, ~500 ms). Bodies become `{ iv, ct }` base64 blobs in the file; titles, tags, and timestamps remain plaintext.

**How to use it**: Settings → Privacy → "Enable password protection". The 4-step setup walks through warning + JSON export gate → password → identification → confirm.

**Available since**: v1.3

**Notes & limits**: **no recovery flow**. If you forget the password, the encrypted bodies are unrecoverable. The setup *requires* a JSON export first.

#### Lock screen identification

The lock screen shows configurable identifying info: a friendly title (e.g. "Personal Journal"), a subtitle, and the filename. With "Hide identifying info" enabled, the screen collapses to a single "Locked" — the most private option.

**Available since**: v1.3

### Multi-user attribution

#### Per-browser identity

The first time a browser opens a Quire file, it asks for your name. After that, every leaf you create or edit records you as the author or last editor. Sharing the file with someone else prompts *their* browser to identify themselves; existing chips stay untouched and a new entry joins the `users` registry.

**Available since**: v1.1

**Notes & limits**: **not real-time collaboration**. Treat it as turn-taking — while one person edits, the others wait.

#### Author chips

Coloured initials chips render in the leaf header (`[BK]` for Baijnath Kumar) with a tooltip showing the full name and creation/last-edit info. Different authors and editors render as `[author] → [editor]`.

**Available since**: v1.1

#### People sidebar

A section listing every user in the registry with their leaf count, plus a `→ you` marker on the current user.

**Available since**: v1.1

#### Schema-aware migration of legacy authors

A wiki created before v1.1 (no users registry) gets a synthetic *Legacy author* on load — every existing leaf is reattributed to it with a muted `··` chip.

**Available since**: v1.1

### Customisation

| Theme | Accent | Font pair | Density | Layout |
|---|---|---|---|---|
| paper / ink / mono | ochre / sage / indigo / rust / plum | editorial / modern / classic / terminal | compact / regular / comfy | river / stack |

Toggle sidebar / backlinks / spine numbers individually. All settings live in `WikiState.settings` and travel with the file.

**Available since**: v1

### Backups, restore, migration (new in v1.6)

Quire has one mechanism for moving content into a wiki: import from JSON.

**Backup**: Settings → "Export to JSON". A `.json` file downloads with your full wiki content (plaintext for readable folders; encrypted folders are exported as-is). Store it somewhere safe.

**Restore**: Settings → "Import JSON file" (or drag the file onto the running app, or click "Import JSON" on the welcome screen). The dialog walks you through conflict resolution with three options per leaf (keep yours / keep theirs / keep both) and per folder (merge / rename theirs).

**Upgrade to a new version**: open your old `quire.html`, export to JSON, download the new file from quire.one, click "Import JSON" on the welcome screen, select the file you just exported. Your old file stays as a secondary backup.

**Self-host with a seeded wiki**: drop a `seed.json` (the output of "Export to JSON" from an authoring file) into the project root before `npm run build`. The built `dist/quire.html` ships with that content baked in. See `seed.example.json` for the structure.

**Available since**: v1.6 (envelope, conflict UI, welcome screen, build-time seed). v1 (raw JSON export — still importable).

**Notes**: the v1.6 envelope is self-describing and includes diagnostic metadata; pre-v1.6 raw exports are still importable. Schema migration is automatic — old JSON files (v1, v1.1, ...) upgrade transparently on import.

### Folders (new in v1.5)

#### Nested folder tree

A "Folders" section in the sidebar shows a collapsible tree of folders. Each leaf lives in at most one folder (`folderId`); the root is a virtual "All notes" entry. Folder names within a parent must be unique; duplicates auto-suffix with `(2)`. Click a folder to filter the river to its contents; toggle "Include sub-folders" in the filter bar.

**Available since**: v1.5

#### Folder context menu

Right-click any folder (or use the ⋯ button) for rename / move / set icon / encrypt / change password / disable encryption / lock now / delete. Delete prompts you to choose **orphan** (leaves become unfiled, sub-folders move to root) or **cascade** (delete everything inside).

**Available since**: v1.5

#### Per-folder encryption

Each folder can have its own password, independent of the wiki master password. Leaf bodies are encrypted with AES-GCM derived via PBKDF2-SHA256 from that folder's password. The 4-step setup dialog warns you, gates progress on a JSON export, lets you pick whether the folder name and leaf count are visible while locked, and shows a confirmation preview before committing.

When folders nest, encryption follows the **closest enclosing protected ancestor**: a leaf is encrypted with whichever protected folder is nearest above it in the tree, and inner protected sub-folders supersede outer ones for their subtree.

**Available since**: v1.5

#### Folder unlock placeholder

Clicking into a locked folder (or trying to follow a wikilink to a leaf inside one) drops a leaf-shaped placeholder into the river with a password prompt. Unlock to reveal the contents; cancel to back out. Unlocked folders relock automatically when the auto-lock timer fires.

**Available since**: v1.5

#### Breadcrumbs

Each leaf header shows its folder path above the title. Click any segment to filter the river to that folder.

**Available since**: v1.5

### Mobile & tablet (new in v1.4)

#### Responsive layouts

The desktop river is replaced with a single-leaf stack layout on phones (≤ 640 px). On tablets in portrait (641 – 1024 px), the sidebar collapses to a rail; in landscape, the layout matches desktop. Layout updates live as you resize or rotate.

**Available since**: v1.4

#### Drawer sidebar

On phones, the sidebar slides in over a scrim. Tap the hamburger to open, tap the scrim or a navigation item to close.

**Available since**: v1.4

#### Touch interaction

All tap targets are at least 44 × 44 px. Hover styles are scoped via `@media (hover: hover)` so they don't sticky on touch. Pull-to-refresh is suppressed on leaf bodies so accidental top-of-page swipes don't reload your work.

**Available since**: v1.4

## How it works

The architecture rests on three layered ideas.

**The single-file philosophy**. Vite's `vite-plugin-singlefile` inlines every JS module and CSS rule into one HTML file. The file embeds a `<script id="quire-data" type="application/json">` block holding the entire wiki state — leaves, settings, users, protection config, everything. On boot, the app parses that block; on every change, the app rewrites it in place via a regex on `document.documentElement.outerHTML`, then writes the result back to disk via the active persistence tier. The browser sees one HTML file with embedded data; the user sees a notebook.

**Layered persistence**. Detection at runtime picks the best available mechanism. Tier A uses `showSaveFilePicker` + a stored `FileSystemFileHandle` (in IndexedDB) for silent auto-save. Tier B falls back to IndexedDB drafts plus a manual download via `⌘S`. Tier C is IndexedDB-only when neither file API is available. The status pill in the top bar always shows the current tier and whether your work is safe.

**Encryption as a layered add-on**. In curtain mode, the lock overlay is just visual. In password mode, every `Leaf.body` becomes `{ iv, ct }` ciphertext — generated by AES-GCM using a key derived from your password via PBKDF2. The key lives in module-level memory (never serialised); on lock, the key and the decrypted-body cache are wiped. The verifier (a known plaintext encrypted with your key) lets us validate passwords cheaply, without decrypting any leaf. Lazy decryption populates a `Map<LeafID, string>` cache as you view each leaf.

For the deeper version, see `ARCHITECTURE.md`.

## Building from source

```sh
git clone https://github.com/nyotec/Quire.git
cd Quire/quire
npm install
npm run build      # → dist/quire.html
```

The build is a single file. No other assets in `dist/`. To verify:

```sh
ls dist/                     # one file: quire.html
grep -c 'quire-data' dist/quire.html   # 3 — the regex, the script tag, and one in the bundled source
```

To run the dev server:

```sh
npm run dev
```

Type-check without emitting:

```sh
npx tsc --noEmit
```

## Browser support

| Browser | Tier | Notes |
|---|---|---|
| Chrome / Edge / Brave / Arc / Opera (desktop) | A | Silent auto-save after one-time picker. Full feature set. |
| Firefox / Safari (desktop) | B | Auto-save to IndexedDB; ⌘S downloads rebuilt HTML. |
| iOS Safari / Android Chrome | B | Mobile = no File System Access API, but Tier B works. |
| Private mode / sandboxed iframes | C | IndexedDB only; export to JSON regularly. |
| IE 11 / Chrome < 95 | unsupported | Modern features (BigInt, optional chaining, dynamic imports) are required. |

The File System Access API is the difference between Tier A and Tier B; it's currently only shipped in Chromium-family browsers.

### `file://` caveat

IndexedDB on `file://` URLs is scoped per file path on most browsers. **Moving `quire.html` to a new folder = new origin = empty IndexedDB at the new location.** Drafts, the connected file handle, and your per-browser identity are bound to the original location. If you move the file, reconnect via Settings → Storage → *Connect file* and re-identify if needed.

## Privacy & security

Two modes, deliberately distinct.

**Curtain mode** is visual hiding only. The on-disk file is unchanged; anyone with the file (or with DevTools open while the overlay is showing) can read everything. Useful for "don't let the person walking past my desk read my notes."

**Password mode** encrypts leaf bodies with AES-GCM (256-bit), key derived via PBKDF2-SHA256 from your password. Setup is a 4-step dialog that *requires* you to first export a JSON backup before you can commit — because there is no recovery flow.

### What this does NOT protect

- **Memory protection.** While unlocked, decrypted content is in JavaScript memory and visible via DevTools. Anyone with access to your unlocked browser can read everything.
- **Keylogger protection.** None. If your machine is compromised, the password is captured.
- **Metadata leak.** Leaf titles, tags, timestamps, user records, and the structure of the wiki are visible in the HTML file even when locked. Only bodies are encrypted.
- **Lock screen identification is plaintext.** The lock title, description, filename, and "saved time" displayed on the lock screen are unencrypted by design — they're meant to help you identify which wiki you're unlocking. If even the wiki's *name* should be hidden, enable "Hide identifying info" in privacy settings.
- **Forgotten password recovery.** None. Setup requires a JSON export precisely because there is no recovery mechanism.
- **Side-channel attacks.** PBKDF2 timing on a malicious page next to the wiki could theoretically be measured. Not a realistic threat for personal use, but real for adversarial threat models.
- **The HTML file's existence.** Even encrypted, the file's presence on disk reveals "this person has notes." Plausible-deniability is not in scope.

If your threat model includes any of those, use a tool designed for it — Standard Notes, Cryptpad, age-encrypted markdown files in a Git repo, etc. Quire's password mode is for the realistic middle ground: shared laptops, casual privacy, "don't let my spouse read my journal," "protect this from a colleague who could briefly use my unlocked machine."

## Keyboard shortcuts

The shortcut scheme deliberately avoids browser-reserved keys (`⌘W`, `⌘N`, `⌘T`, `⌘[`/`⌘]`) that the browser swallows before the page sees them. Press `?` at any time for the in-app help dialog.

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette (works inside the editor too) |
| `⌘J` / `Ctrl+J` | New leaf |
| `⌘Return` / `Ctrl+Enter` | Toggle edit mode |
| `⌘⌫` / `Ctrl+Backspace` | Close focused leaf |
| `⌘⇧[` / `⌘⇧]` | Move focused leaf left / right |
| `Tab` / `Shift+Tab` | Focus next / previous leaf |
| `⌘S` / `Ctrl+S` | Save Wiki |
| `⌘,` / `Ctrl+,` | Open settings |
| `⌘⇧K` / `Ctrl+Shift+K` | Toggle Tasks view |
| `⌘;` / `Ctrl+;` | Lock now |
| `?` | Show keyboard shortcuts |
| `Esc` | Close palette / drawer / dialog |

Inside the palette: `>` for commands, `#` for tags, `@` for authors, `:` for folders, `!` for tasks, `/` for full-text body search.

**Troubleshooting**: if shortcuts don't work, check for browser extensions that intercept keyboard input (Vimium, Vimari, etc.) — disable them on `file://` URLs.

## Data format

The embedded data block is a `<script id="quire-data" type="application/json" data-encoding="...">` element in `<head>`. The body is either plain JSON (`data-encoding="plain"` or attribute absent) or LZ-compressed UTF-16 (`data-encoding="lz-utf16"`, added in v1.4 to halve large-file sizes). Schemas:

- **v1**: leaves, openIds, focusedId, settings, lastSaved, wikiId.
- **v2**: + users registry; leaves carry `authorId`, `lastEditedBy`, `contributors`. Migration auto-creates a *Legacy author* on first read.
- **v3**: + protection (curtain / password) and autolock config. Leaf bodies become `EncryptedField` in password mode.

Migrations are forward-only and idempotent. Older builds opening a newer-version file may fail on encrypted bodies (a v1.2 build sees an object instead of a string in `body` and crashes the renderer). Don't downgrade once password mode is enabled.

## File size & performance

Empty wiki size targets after v1.4:

- **dist/quire.html** (no leaves, fresh build): ≈ 250 – 400 KB
- **with 1000 leaves of typical content**: ≈ 1.5 – 2.5 MB

Past 10 MB, save times become perceptible on slow disks and the file approaches email-attachment limits. Quire warns once when a wiki crosses 10 MB. Mitigations: archive old leaves into separate files, or export to markdown ZIP and re-import a curated subset.

The v1.4 build switches React for Preact (3 KB runtime in place of 140 KB) and compresses the embedded data block with lz-string. Combined, this typically halves total file size for moderate wikis.

## Frequently asked questions

**Q: Where does my data go?**

A: It stays in the HTML file on your disk. Quire never sends data anywhere. There is no server, no account, no telemetry, no analytics. If you don't share the file, no one but you can read it.

**Q: What if I lose the password?**

A: Your data is permanently inaccessible. There is no recovery mechanism. The setup flow forces you to export a JSON backup before enabling password mode for exactly this reason. Use a password manager.

**Q: Can I sync between devices?**

A: Not directly. The file is the unit of portability. Common workarounds: keep the file in a synced folder (Dropbox, iCloud, Syncthing), email yourself updated copies, or use a USB drive. Real-time multi-device sync would require a server, which Quire deliberately doesn't have.

**Q: Can multiple people edit the same wiki simultaneously?**

A: No, not in real-time. Multiple people can use the same file at different times, and Quire records who created and last-edited each leaf (multi-user attribution). True real-time collaboration requires a backend; for that use case, consider tools like CryptPad or Standard Notes.

**Q: Can I publish a single leaf as a webpage?**

A: Not directly in v1.4 — public sharing of individual leaves is on the roadmap. For now, copy a leaf's content as Markdown and publish it through any static site or blog.

**Q: How do I back up my wiki?**

A: Two options. (1) Copy the HTML file itself — it IS the wiki. (2) Use Settings → "Export to JSON" to produce a plaintext snapshot. The JSON is the safety net against password loss; the HTML is more compact.

**Q: How do I update to a new Quire version?**

A: Export your current wiki to JSON. Download the new `quire.html` from quire.one. Open it. Click "Import JSON" on the welcome screen. Select your JSON file. Done. Keep your old file as a secondary backup until you're sure the new one works.

**Q: What happens if I close the tab without saving?**

A: On Chromium with the file connected (Tier A), saves are silent and continuous — you almost certainly didn't lose anything. On Firefox or Safari (Tier B), changes are auto-saved to IndexedDB; reopening the same file in the same browser will offer to restore unsaved drafts. To make changes durable across browsers/devices, hit Save Wiki and replace the original file with the download.

**Q: Can I run this on a server?**

A: You can serve `quire.html` from any static host — it's just an HTML file. But Quire isn't *meant* to run on a server. Each user opens their own file. Multi-user collaboration on a single hosted file would require infrastructure Quire deliberately doesn't have.

**Q: Why is it called Quire?**

A: A quire is an old bookbinding term — a small bundle of folded sheets sewn together to make a section of a book. The app's data model uses "leaves" as the unit of content; many leaves bound together make a quire. The name fits the editorial, paper-rooted aesthetic of the design.

**Q: Is this open source?**

A: License is MIT — see `LICENSE`. The code is free to use, modify, and redistribute under those terms.

**Q: Why such hard limits on encryption (no recovery, no metadata encryption)?**

A: Honesty. A "we'll figure something out" recovery flow is a backdoor, and a backdoor is a vulnerability. Encrypting metadata too would block search, palette, sidebar — the things that make Quire usable. The trade-offs are deliberate; the README spells them out so users know what they're getting.

## Contributing

Issues and pull requests are welcome.

- The visual design and interaction model are deliberate. Discuss before redesigning.
- Don't break the prototype CSS class names — the React tree must produce the same DOM.
- Keep the **single-file promise**. No runtime CDN, no separate assets, no service worker.
- Run `npx tsc --noEmit` and `npm run build` before opening a PR.
- For UI changes, check all three themes (paper / ink / mono) and both layouts (river / stack), and at least one mobile width.

### Adding a feature

- **A new theme** — add an entry to `THEMES` in `src/App.tsx` and a new option to `ThemeName` in `src/types.ts`.
- **A new command palette command** — add an entry in `src/components/CommandPalette.tsx` and handle it in `App.tsx → onPaletteCommand`.
- **A custom inline syntax** — extend `renderInline` in `src/lib/markdown.tsx`. The renderer returns React/Preact nodes, so any custom token can carry click handlers.
- **A new plugin** — add it to `DEFAULT_SETTINGS.plugins` in `src/types.ts`, label it in `pluginLabel()` in `src/components/SettingsDrawer.tsx`, and gate the relevant feature on `settings.plugins[id]` in `App.tsx`.

## Roadmap

- **v1.5 — folders / hierarchy**. A second axis of organisation alongside tags, useful for project-based notebooks.
- **v1.6 — cross-version migration helpers**. A "downgrade" path that re-encodes a v3 file as v2 by decrypting bodies (with current password).
- **Later** — single-leaf publish (export as a small standalone HTML), graph view, embedded media (images / PDFs) inlined as base64.

## Changelog

- **v1.0** — single-file build, layered persistence (Tier A/B/C), wikilinks, backlinks, tags, command palette, settings drawer.
- **v1.1** — multi-user attribution: per-browser identity, author chips, People sidebar, `@` palette mode, schema migration.
- **v1.2** — tasks: interactive checkboxes that surgically edit markdown, optional `@YYYY-MM-DD` due dates, system-wide Tasks view, `!` palette mode, sidebar Tasks row + Upcoming list.
- **v1.2.1** — keyboard shortcut correction: avoids browser-reserved keys (`⌘W`, `⌘N`, `⌘T`, `⌘[`/`⌘]`), layout-independent matching via `event.code`, LIFO modal handler stack, in-app `?` help dialog.
- **v1.3** — auto-lock with curtain mode + opt-in password mode (PBKDF2 + AES-GCM body encryption); lock screen with configurable identifying info; manual lock (`⌘;`); IDB drafts stay encrypted in password mode.
- **v1.4** — responsive design (phones, tablets), file size reduction (Preact + lz-string compression), comprehensive README.
- **v1.5** — folders + per-folder encryption. Nested folder tree in the sidebar with right-click context menu, breadcrumbs in leaf headers, `:` palette mode for finding folders. Each folder can have its own password (independent of the v1.3 wiki master password); nested folders follow the closest-enclosing-protected-ancestor rule. Schema v3 → v4 migration is forward-only.
- **v1.6** — JSON import with conflict resolution, formalized export envelope, build-time seeding via `seed.json`, first-run welcome screen with "Start fresh" / "Import JSON". One mechanism (JSON) covers backup, restore, version upgrade, and content seeding for self-hosters. Centralized schema migrations.

## License

MIT. See [LICENSE](./LICENSE).

## Acknowledgements

- The single-file format and "your notes are the page you're reading" philosophy come straight from [TiddlyWiki](https://tiddlywiki.com/).
- The Zettelkasten ideas (one idea per leaf, link as the work, atomic notes) are from Sönke Ahrens via Niklas Luhmann.
- The "river" metaphor (horizontal scroll of open notes you read together) borrows from [Andy Matuschak's working notes](https://notes.andymatuschak.org/).
- Libraries used: [Preact](https://preactjs.com), [Vite](https://vitejs.dev), [Zustand](https://github.com/pmndrs/zustand), [Fuse.js](https://fusejs.io), [idb](https://github.com/jakearchibald/idb), [JSZip](https://stuk.github.io/jszip/), [lz-string](https://github.com/pieroxy/lz-string).
- Web standards: File System Access API, Web Crypto API, IndexedDB, BroadcastChannel.
