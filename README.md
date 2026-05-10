# Quire

> A single-file note-taking app. Email it, drop it on a USB stick, or open it from `file://` — all your notes live **inside the HTML file itself**.

Quire is the spiritual descendant of TiddlyWiki: an entire personal wiki — React app, styles, and your data — bundled into one HTML file you can carry, share, and edit offline. No server, no database, no accounts, no sync infrastructure. Just one file.

```
                ┌──────────────────────┐
                │   quire.html         │ ← rewrites itself
                │                      │   in place on save
                │   • inlined React    │
                │   • inlined CSS      │
                │   • <script          │
                │     id="quire-data"> │
                │     {your notes}     │
                │     </script>        │
                └──────────────────────┘
```

---

## Highlights

- **One file, runs anywhere.** No build step at runtime, no CDN, no requests. Open from `file://` and it just works.
- **Layered persistence.** Silent auto-save on Chromium (File System Access API). Manual `⌘S` download on Firefox/Safari. IndexedDB-only fallback in private mode. The status pill in the top bar always tells you which tier is active and whether your work is safe.
- **Wikilinks & backlinks.** `[[Like this]]` opens another leaf in the river beside the one you're reading. Backlinks are computed automatically and shown in the focused leaf's footer.
- **Tags & full-text search.** `#tags` extracted from prose, indexed, surfaced in the sidebar and command palette. Fuzzy title search with [Fuse.js](https://fusejs.io/), tag filter, full-body search, all reachable from `⌘K`.
- **Three themes, two layouts.** Paper, Ink, Mono. River (horizontal cards) or Stack (vertical column). Density compact/regular/comfy. Settings drawer is a real Settings drawer, not a debug tool.
- **Multi-user attribution.** Share the file with family or a small team. Each browser is a single resident user. Every leaf records its creator, last editor, and full contributor list. Author chips in the leaf header, a People sidebar, and an `@` mode in the palette let you see at a glance who wrote what.
- **Tasks, in-place.** Markdown checkboxes (`- [ ] …`) actually toggle when clicked — the underlying markdown is edited surgically, not re-serialised. Optional `@YYYY-MM-DD` due dates render as chips with overdue colouring. `⌘⇧K` opens a system-wide Tasks view aggregated from every leaf.
- **Privacy, two modes.** Auto-lock after inactivity (curtain mode, default — visual hiding only). Opt-in password mode encrypts every leaf body with AES-GCM derived from your password via PBKDF2; locking wipes the in-memory key. The lock screen shows configurable identifying info (lock title, filename, description) — or hides everything behind a single "Locked".
- **Markdown, with care.** A purpose-built renderer that returns React nodes (not HTML strings) so wikilinks and tags carry click handlers. Headings, hr, fenced code, blockquote, mixed bullet/task lists, tables, bold/italic/inline-code, external links.
- **Tiny.** ~360 KB total — React + ReactDOM + the entire app + your starting notes — all gzipped to about 110 KB.

---

## Get a build

[![Build Quire](https://github.com/nyotec/Quire/actions/workflows/build.yml/badge.svg)](https://github.com/nyotec/Quire/actions/workflows/build.yml)

The CI workflow produces a `quire-html` artifact on every push and PR. Tagged releases attach a `quire.html` file to the GitHub release automatically.

To build locally:

```sh
git clone https://github.com/nyotec/Quire.git
cd Quire/quire
npm install
npm run build
```

Open `dist/quire.html` in your browser. Done.

---

## Using it

1. **Open `quire.html`.** Double-click, or drag it into Chrome/Firefox/Safari.

2. **In Chrome / Edge / Brave / Arc** — click *Connect file* on the onboarding card and pick where to save. Every change auto-saves silently from then on.

3. **In Firefox / Safari** — your notes auto-save to that browser's IndexedDB on every keystroke. When you're ready to make the changes permanent in the file, hit `⌘S` (or click the *Save* button) — the rebuilt HTML downloads. Replace your old `quire.html` with the new one.

4. **In private mode / sandboxed iframes** — Quire still works, but only stores in the browser. Export to JSON regularly to back up.

The status pill in the top bar tells you the truth:

| Pill | Meaning |
|---|---|
| 🟢 *Saved · 4s ago* | Tier A, all flushed to disk |
| 🟡 *Draft · 12 changes* | Tier B, IndexedDB up to date but file is stale; click to download |
| 🔵 *Saving…* | write in flight |
| 🔴 *Save failed · retry* | write errored; click to retry |
| ⚪ *Browser only* | Tier C, file access unavailable |

### Multi-user attribution

The first time a browser opens a Quire file, it asks for your name and initials. After that, every leaf you create or edit records you as the author or last editor.

When you share the file with someone else, *their* browser will ask *them* to identify themselves on first open — your existing notes and chips stay untouched, and a new entry joins the `users` registry inside the file.

This is **not real-time collaboration**. Treat Quire as an annotated turn-taking notebook: while one person is editing, the others wait. When they're done, save and pass the file along (or AirDrop / email / USB stick — whichever you prefer).

### Keyboard shortcuts

Press `?` at any time to open the in-app shortcut help. The scheme deliberately avoids browser-reserved keys (`⌘N`, `⌘W`, `⌘T`, `⌘[`/`⌘]`) that the browser swallows before the app sees them.

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette (works in editor too) |
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

Inside the palette: `>` for commands, `#` for tags, `@` for authors, `!` for tasks, `/` for full-text body search.

---

## Browser support

| Browser | Tier | Behavior |
|---|---|---|
| Chrome, Edge, Brave, Arc, Opera | A | Silent auto-save to file (after one-time picker) |
| Firefox, Safari, mobile browsers | B | Auto-save to IndexedDB; manual download via ⌘S |
| Private mode / sandboxed iframes | C | IndexedDB only; export to back up |

The File System Access API is the difference between Tier A and Tier B; it's [currently only shipped in Chromium-family browsers](https://caniuse.com/native-filesystem-api).

### `file://` caveat

IndexedDB on `file://` URLs is scoped per file path on most browsers. **Moving `quire.html` to a new folder = new origin = empty IndexedDB at the new location.** Drafts, the connected file handle, and your per-browser identity are all bound to the original location. If you move the file, reconnect via Settings → Storage → *Connect file* and re-identify if needed.

---

## Project structure

```
Quire/
├── README.md                 # this file
├── .github/workflows/        # CI: build.yml + release.yml
└── quire/                    # the app source
    ├── index.html            # vite entry; contains the <script id="quire-data"> block
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts        # configured with vite-plugin-singlefile
    ├── README.md             # detailed app-level README
    ├── ARCHITECTURE.md       # save/load loop, IDB flow, hydration sequence
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── styles.css        # the entire app CSS
        ├── types.ts
        ├── store/
        │   ├── useWikiStore.ts
        │   └── persistence.ts # WikiPersistence class (Tier A/B/C)
        ├── lib/
        │   ├── markdown.tsx
        │   ├── wikilinks.ts
        │   ├── search.ts     # Fuse.js setup
        │   ├── hotkeys.ts
        │   ├── users.ts      # initials, migration, touchLeaf
        │   ├── userColors.ts # 8-entry palette
        │   └── utils.ts
        ├── components/
        │   ├── TopBar.tsx
        │   ├── Sidebar.tsx
        │   ├── LeafCard.tsx
        │   ├── CommandPalette.tsx
        │   ├── SettingsDrawer.tsx
        │   ├── Toast.tsx
        │   ├── Icon.tsx
        │   ├── AuthorChip.tsx
        │   └── UserOnboardingModal.tsx
        └── seed/
            └── welcome.ts
```

For implementation details, see [`quire/ARCHITECTURE.md`](./quire/ARCHITECTURE.md).

---

## Tech stack

- **Vite 5** with `@vitejs/plugin-react`
- **`vite-plugin-singlefile`** — inlines all JS/CSS into one HTML
- **React 18** + **TypeScript** (strict)
- **Zustand** for state management
- **idb** (Jake Archibald's promise wrapper) for IndexedDB
- **Fuse.js** for fuzzy search in the command palette
- **JSZip** for the markdown ZIP export

No Tailwind. No UI library. No router. No backend. No service worker.

---

## Privacy

Two modes, deliberately distinct.

### Curtain mode (default)

A full-screen overlay appears after configurable inactivity (default 5 min) or when the tab has been hidden for 30 s, or on `⌘;` / lock button. Pressing any key dismisses it. **This is visual hiding only — no encryption.** The on-disk file is unchanged; anyone with the file (or with DevTools open while the overlay is showing) can read everything. Useful for "don't let the person walking past my desk read my notes."

### Password mode (opt-in)

Encrypts every leaf body with AES-GCM (256-bit), key derived from your password via PBKDF2-SHA256 (~250 k iterations, calibrated per device on setup). Bodies are stored in the file as `{ iv, ct }` base64 blobs; titles, tags, timestamps, and user records remain plaintext. Locking wipes the in-memory key.

Setup is a 4-step dialog that *requires* you to first export a JSON backup before you can commit — because **there is no recovery flow**. If you forget the password, the encrypted bodies are unrecoverable.

### What this does NOT protect

In plain language:

- **Memory protection.** While unlocked, decrypted content is in JavaScript memory and visible via DevTools. Anyone with access to your unlocked browser can read everything.
- **Keylogger protection.** None. If your machine is compromised, the password is captured.
- **Metadata leak.** Leaf titles, tags, timestamps, user records, and the structure of the wiki are visible in the HTML file even when locked. Only bodies are encrypted.
- **Lock screen identification is plaintext.** The lock title, description, filename, and "saved time" displayed on the lock screen are unencrypted by design — they're meant to help you identify which wiki you're unlocking. If even the wiki's *name* should be hidden, enable "Hide identifying info" in privacy settings.
- **Forgotten password recovery.** None. Setup requires a JSON export precisely because there is no recovery mechanism.
- **Side-channel attacks.** PBKDF2 timing on a malicious page next to the wiki could theoretically be measured. Not a realistic threat for personal use, but real for adversarial threat models.
- **The HTML file's existence.** Even encrypted, the file's presence on disk reveals "this person has notes." Plausible-deniability is not in scope.

If your threat model includes any of those, use a tool designed for it — Standard Notes, Cryptpad, age-encrypted markdown files in a Git repo, etc. Quire's password mode is for the realistic middle ground: shared laptops, casual privacy, "don't let my spouse read my journal," "protect this from a colleague who could briefly use my unlocked machine."

## Backups & exports

In addition to `⌘S`, the Settings drawer (`⌘,`) gives you:

- *Export snapshot HTML* — dated copy of the full app, never overwrites the live file.
- *Export markdown ZIP* — one `.md` per leaf with frontmatter; ideal for migrating away.
- *Export JSON* — raw state dump (good for diffs, scripts, or mass-edit workflows).

---

## Contributing

Issues and pull requests are welcome. A few notes:

- The visual design and interaction model are deliberate. Discuss before redesigning.
- Don't break the prototype CSS class names — the React tree must produce the same DOM.
- Keep the **single-file promise**. No runtime CDN, no separate assets, no service worker.
- Run `npx tsc --noEmit` and `npm run build` before opening a PR.
- For UI changes, check all three themes (paper / ink / mono) and both layouts (river / stack).

### Adding a feature

- **A new theme** — add an entry to `THEMES` in `src/App.tsx` and a new option to `ThemeName` in `src/types.ts`.
- **A new command palette command** — add an entry in `src/components/CommandPalette.tsx` and handle it in `App.tsx → onPaletteCommand`.
- **A custom inline syntax** — extend `renderInline` in `src/lib/markdown.tsx`. The renderer returns React nodes, so any custom token can carry click handlers.
- **A new plugin** — add it to `DEFAULT_SETTINGS.plugins` in `src/types.ts`, label it in `pluginLabel()` in `src/components/SettingsDrawer.tsx`, and gate the relevant feature on `settings.plugins[id]` in `App.tsx`.

---

## Versioning

| Version | Highlights |
|---|---|
| v1.0 | Single-file build, layered persistence (Tier A/B/C), wikilinks, backlinks, tags, command palette, settings drawer |
| v1.1 | Multi-user attribution: per-browser identity, author chips, People sidebar, `@` palette mode, schema migration |
| v1.2 | Tasks: interactive checkboxes that surgically edit markdown, optional `@YYYY-MM-DD` due dates, system-wide Tasks view, `!` palette mode, sidebar Tasks row + Upcoming list |
| v1.2.1 | Keyboard shortcut correction: avoids browser-reserved keys (`⌘W`, `⌘N`, `⌘T`, `⌘[`/`⌘]`), layout-independent matching via `event.code`, LIFO modal handler stack, in-app `?` help dialog |
| v1.3 | Auto-lock with curtain mode + opt-in password mode (PBKDF2 + AES-GCM body encryption); lock screen with configurable identifying info; manual lock (`⌘;`); IDB drafts stay encrypted in password mode |

The HTML data block carries `schemaVersion`. Old files auto-upgrade on load — you can always open a v1 file in a v1.1 build, never the other way around.

---

## License

MIT. See [LICENSE](./LICENSE).

---

## Acknowledgements

- The single-file format and "your notes are the page you're reading" philosophy come straight from [TiddlyWiki](https://tiddlywiki.com/).
- The Zettelkasten ideas (one idea per leaf, link as the work, atomic notes) are from Sönke Ahrens via Niklas Luhmann.
- The "river" metaphor (horizontal scroll of open notes you read together) borrows from [Andy Matuschak's working notes](https://notes.andymatuschak.org/).
