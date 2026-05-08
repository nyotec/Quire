# Build Quire — a single-file note-taking app

## What I want you to build

Take the attached **Quire** prototype (an HTML + JSX prototype, currently using CDN-loaded React + Babel-in-browser) and turn it into a **production-grade, true single-file note-taking application** that I can email, drop on a USB stick, or open from `file://` and have it just work — with all data persisting **inside the HTML file itself**, TiddlyWiki-style.

The visual design, interaction model, and component structure of the prototype are the spec. Don't redesign it. Match it pixel-for-pixel and behavior-for-behavior, then make it real.

---

## The core architectural shift

The prototype loads React, ReactDOM, and Babel from `unpkg.com` and compiles JSX in the browser. **The production build must:**

1. Be **one** `quire.html` file. No external requests at runtime, no separate CSS/JS files, no CDN dependencies. Fonts inlined or system-stack fallback.
2. Bundle React, ReactDOM, all components, all CSS, and the user's notes data into that one file.
3. Use **Vite + `vite-plugin-singlefile`** for the build pipeline (React 18, TypeScript). Output `dist/quire.html`.
4. Work fully offline from `file://`. No `fetch()` to local files, no service workers required, no ES module imports across files at runtime.
5. Persist user data using the **layered persistence strategy** detailed in the next section.

---

## Persistence — the layered strategy (read this carefully)

This is the most important and most easily-botched part of the build. Get this right before anything else.

The goal: **as close to silent auto-save as the user's browser will allow**, with a safety net that ensures no data is ever lost regardless of which browser they use.

### Three tiers, detected at runtime

The app must detect what the browser supports and pick the best available tier on each load:

#### Tier A — Silent file auto-save (Chromium: Chrome, Edge, Brave, Opera, Arc)

When `'showSaveFilePicker' in window` is true:

1. On first load (no stored handle yet), show a one-time onboarding card: *"Connect this app to your file so changes save automatically."* with a single button.
2. Clicking the button calls `window.showSaveFilePicker({ suggestedName: 'quire.html', types: [{ description: 'Quire wiki', accept: { 'text/html': ['.html'] } }] })`.
3. Store the resulting `FileSystemFileHandle` in IndexedDB under key `fileHandle:{wikiId}`. **The handle itself is structured-clonable; it serializes into IndexedDB directly — do not try to JSON.stringify it.**
4. On every subsequent load, retrieve the handle, call `await handle.queryPermission({ mode: 'readwrite' })`. If `'granted'`, proceed silently. If `'prompt'`, call `requestPermission()` — this shows one quick confirmation dialog. If denied or the file is gone (`NotFoundError` on read), fall back to Tier B and inform the user.
5. **Auto-save loop**: on every state change, debounce 500ms, then write the full rebuilt HTML via `handle.createWritable()` → `write(html)` → `close()`. Show a tiny "Saved · 2s ago" indicator in the status bar. No prompts, no downloads, no user action.
6. Use a **mutex/lock** around writes (a simple `isWriting` flag with a queued pending write) to prevent concurrent writes from corrupting the file.

#### Tier B — IndexedDB auto-save + manual file save (Firefox, Safari, older browsers)

When the File System Access API is not available:

1. Auto-save **every state change to IndexedDB**, debounced 400ms. Key: `draft:{wikiId}`. Value: full `WikiState`.
2. The visible "Save to file" button in the top bar shows a colored dot + count when there are changes that haven't been flushed to the HTML file yet (e.g. "Save · 12 changes").
3. Clicking it (or `⌘S`) triggers a download of the rebuilt HTML using `Blob` + `<a download>`. Filename matches the originally-loaded filename if known, else `quire.html`. Show a toast: *"Downloaded — replace your old quire.html with this file to keep changes permanent."*
4. Register a `beforeunload` handler that fires the browser's native "Are you sure you want to leave?" prompt **only if** there are unsaved-to-file changes. Don't be annoying — if everything is flushed, no prompt.
5. Optional polish: every 5 minutes of active editing with unsaved changes, show a non-blocking toast nudging the user to save.

#### Tier C — IndexedDB-only fallback (last resort)

If both file APIs fail (private browsing modes, sandboxed iframes, etc.), the app still works with IndexedDB only. Show a persistent banner at the top: *"This browser blocks file access. Your notes are saved in this browser only — export to JSON regularly to back up."*

### Boot sequence (load order — implement exactly this)

On `App` mount:

1. Parse the embedded `<script id="quire-data" type="application/json">` block. This is the **canonical state** as of the last file save. If empty or absent, treat as first-run and seed with the welcome leaf.
2. Read `wikiId` from that state. If first-run, generate a new uuid for `wikiId`.
3. Open IndexedDB (database name `quire`, version 1, stores: `drafts`, `handles`, `meta`).
4. Look up `draft:{wikiId}`. If a draft exists AND `draft.lastSaved > embeddedState.lastSaved`, show a non-blocking modal:
   > **Unsaved changes found.** You have edits from {relative time} that weren't saved to the file. Restore them?  
   > [ Restore draft ]  [ Discard ]
5. After user decides, hydrate the Zustand store with the chosen state.
6. Detect tier (A/B/C) and start the auto-save loop appropriate to that tier.
7. If Tier A and a stored handle exists, attempt to verify it (permission + file readable). On any failure, downgrade to Tier B for this session and surface the issue.

### Save sequence (the actual write)

The `saveToFile` function must:

1. Serialize the current `WikiState` to a compact JSON string. Strip transient UI state (`paletteOpen`, `editingId`, etc.) — only persist data + settings + open/focused IDs.
2. Get the current document HTML: `'<!DOCTYPE html>\n' + document.documentElement.outerHTML`. (`outerHTML` strips the doctype; you must prepend it.)
3. Replace the data block using a **non-greedy regex anchored on the id attribute**:  
   `/(<script\s+id="quire-data"[^>]*>)[\s\S]*?(<\/script>)/`  
   → `$1{escaped JSON}$2`. **Escape `</` inside the JSON to `<\/`** to prevent any embedded string from terminating the script tag early.
4. Write the resulting string via the active tier's mechanism.
5. After successful write: update `lastSaved` in state, clear the IndexedDB draft (or update it to match), update the "Saved" indicator.
6. On any write error: **never overwrite `lastSaved`**, keep the draft, show an error toast with a "Retry" action.

### Things to be careful about

- **JSON injection in the script tag**: if a user writes `</script>` literally inside a leaf body, the regex replacement won't break (because the JSON encoding handles it), but you still must escape `</` to `<\/` in the serialized output, or the browser will close the script tag prematurely on the next load.
- **`file://` origin scoping**: IndexedDB on `file://` URLs is scoped per file path on most browsers. Moving `quire.html` to a new folder = new origin = empty IndexedDB at the new location. Document this clearly in the README.
- **Multiple tabs of the same file**: use a `BroadcastChannel('quire:{wikiId}')` to coordinate. If tab A saves, tab B should reload the embedded state (or at least show a "this file was updated elsewhere" warning).
- **Large files**: at ~5MB+ of HTML, the `outerHTML` rebuild starts taking noticeable time. Measure and warn the user once their wiki crosses 10MB. (For a notes app, 10MB ≈ tens of thousands of leaves — unlikely to hit, but worth a friendly warning.)
- **Don't use `localStorage`** for anything substantive. It's synchronous, capped at ~5MB, and gets cleared aggressively. Use it only for tiny UI state (e.g. "has user dismissed the onboarding card") if at all.
- **Never claim a save succeeded until the writable's `close()` resolves**. The write is not durable until then.

### What the user sees in the UI

A small **status pill** in the top bar, just left of the search box, that always shows the current persistence state:

- 🟢 `Saved · 4s ago` — Tier A, all flushed.
- 🟡 `Draft · 12 changes` — Tier B, IndexedDB up to date but file is stale; click to save.
- 🔵 `Saving…` — write in flight.
- 🔴 `Save failed · retry` — write errored; click to retry.
- ⚪ `Browser only` — Tier C, file access unavailable.

This pill is the user's source of truth for "is my work safe." Make it honest and prompt.

---

## Source material (attached)

Read these files first; they are the spec:

- `Quire.html` — full CSS (~840 lines, design system with three themes, density modes, layouts).
- `js/app.jsx` — main `App` component, state shape, theme/font/accent maps, keyboard shortcuts.
- `js/components.jsx` — `TopBar`, `Sidebar`, `LeafCard`, `CommandPalette`, `Icon` set, `QuireUtil` helpers.
- `js/markdown.jsx` — custom markdown renderer with `[[wikilinks]]` and `#tags` (returns React nodes, not strings — keep this property; it's how clicks on wikilinks work).
- `js/data.js` — seed `SEED_LEAVES` (15 example notes) and `SEED_OPEN`.
- `js/tweaks-panel.jsx` — **prototyping tool only, do not include in production**. The Tweaks panel is for design-time tweaking; the equivalent settings should live in a real Settings drawer in the app (same controls, same options, but accessed from the top bar's gear icon).

---

## Technical stack — exact choices

- **Vite 5+** with `@vitejs/plugin-react`
- **`vite-plugin-singlefile`** — inlines all JS/CSS into one HTML
- **React 18** + **TypeScript** (strict mode)
- **No Tailwind**, no UI library — port the existing CSS as-is into a single `styles.css` that gets inlined. The CSS in the prototype is already excellent; preserve every variable, every class.
- **Zustand** for state management (lightweight, no Provider boilerplate)
- **idb** (Jake Archibald's promise wrapper) for IndexedDB
- **Fuse.js** for fuzzy search in the command palette
- No router. The app is single-view; "navigation" is opening leaves into the river.

---

## Functional requirements — what must work

### 1. Data model (TypeScript types)

```ts
type LeafID = string;

interface Leaf {
  id: LeafID;            // slug + random suffix
  title: string;
  body: string;          // markdown source
  tags: string[];        // derived from body, but cached
  pinned?: boolean;
  isJournal?: boolean;
  created: string;       // ISO
  edited: string;        // ISO
}

interface WikiState {
  schemaVersion: 1;
  wikiId: string;        // uuid, stable per file
  leaves: Leaf[];
  openIds: LeafID[];
  focusedId: LeafID | null;
  settings: Settings;
  lastSaved: string;     // ISO
}

interface Settings {
  theme: 'paper' | 'ink' | 'mono';
  accent: 'ochre' | 'sage' | 'indigo' | 'rust' | 'plum';
  fontPair: 'editorial' | 'modern' | 'classic' | 'terminal';
  density: 'compact' | 'regular' | 'comfy';
  layout: 'river' | 'stack';
  sidebar: boolean;
  backlinks: boolean;
  spineNumbers: boolean;
  plugins: Record<string, boolean>;
}
```

### 2. Markdown rendering

Port `markdown.jsx` to TypeScript verbatim. It must continue to:
- Return React nodes (not HTML strings) so wikilinks/tags carry click handlers.
- Support: headings 1–6, hr, fenced code (with language label), blockquote, bullet/task lists (mixed), tables, bold/italic/inline-code, `[text](url)`, `[[wikilinks]]`, `#tags`.
- Render unresolved wikilinks with the `q-wlink-new` class (dim, dashed underline). Clicking creates the leaf.

### 3. Wikilinks & backlinks

- Forward links: parse `[[Title]]` from each leaf's body.
- Backlinks index: built with `useMemo` over the full leaves array; each backlink carries a 120-char snippet of the sentence containing the link.
- Click an existing wikilink → opens the target leaf in the river beside the current one (don't navigate away — append/move to focus).
- Click an unresolved wikilink → creates a new leaf with that title and opens it.

### 4. Tags

- Extracted from body via `/(^|\s)#([a-zA-Z][\w/-]*)/g`.
- Sidebar shows a tag cloud with counts.
- Clicking a tag in sidebar or in a leaf filters the river to leaves with that tag (filter bar appears at top of river with a "clear" button).

### 5. The "river" — open leaves

- Two layouts: `river` (horizontal scroll, leaves side-by-side) and `stack` (vertical, centered).
- Drag-to-reorder open leaves (the `q-leaf-handle` is the drag affordance).
- `⌘[` / `⌘]` move focused leaf left/right.
- `⌘W` closes the focused leaf.
- Each leaf can be in view mode or edit mode. `⌘E` toggles edit on the focused leaf.

### 6. Command palette (`⌘K`)

The palette has four modes, switched by leading character:
- *(no prefix)* — fuzzy find by title (use Fuse.js, weight title heavily)
- `>` — commands (New leaf, theme switches, layout switches, **Save Wiki**, **Export**, **Open settings**)
- `#` — find by tag
- `/` — full-text body search with snippet preview

Arrow keys navigate, Enter activates, Esc closes. If no match, Enter creates a new leaf with the current query as title.

### 7. Keyboard shortcuts (global)

| Shortcut | Action |
|----------|--------|
| `⌘K` / `Ctrl+K` | Command palette |
| `⌘N` / `Ctrl+N` | New leaf |
| `⌘E` / `Ctrl+E` | Toggle edit on focused leaf |
| `⌘W` / `Ctrl+W` | Close focused leaf |
| `⌘[` / `⌘]` | Move focused leaf left/right |
| `⌘S` / `Ctrl+S` | **Save Wiki** (write back to file) |
| `⌘,` / `Ctrl+,` | Open settings drawer |
| `Esc` | Close palette / settings |

Use a small custom hook (e.g. `useHotkey`) — don't pull in a library.

### 8. Save mechanism — module shape

The persistence behavior is fully specified in the **"Persistence — the layered strategy"** section above. This section just locks down the module API.

Implement a `WikiPersistence` class with this exact shape:

```ts
type Tier = 'A' | 'B' | 'C';

interface SaveStatus {
  tier: Tier;
  state: 'saved' | 'dirty' | 'saving' | 'error' | 'browser-only';
  lastSaved: string | null;
  pendingChanges: number;
  errorMessage?: string;
}

class WikiPersistence {
  // Detection
  detectTier(): Tier;

  // Load path
  loadFromHTML(): WikiState | null;
  loadDraftFromIDB(wikiId: string): Promise<WikiState | null>;

  // Tier A — silent file writes
  hasStoredHandle(wikiId: string): Promise<boolean>;
  connectFile(wikiId: string): Promise<void>;        // shows picker once
  verifyHandle(wikiId: string): Promise<boolean>;    // checks permission + readability
  writeToHandle(wikiId: string, html: string): Promise<void>;

  // Tier B — manual file save
  downloadHTML(html: string, filename: string): void;

  // Tier C / always-on
  saveDraftToIDB(state: WikiState): Promise<void>;   // debounced upstream
  clearDraftFromIDB(wikiId: string): Promise<void>;

  // Unified save entry point (picks tier internally)
  save(state: WikiState): Promise<SaveStatus>;

  // Exports — always trigger downloads, never overwrite the live file
  exportSnapshot(state: WikiState): Promise<void>;   // dated copy of full HTML
  exportMarkdown(state: WikiState): Promise<void>;   // .zip of one .md per leaf (use jszip)
  exportJSON(state: WikiState): Promise<void>;

  // Status stream — components subscribe to render the status pill
  subscribe(listener: (status: SaveStatus) => void): () => void;
}
```

Cross-tab coordination uses `BroadcastChannel('quire:{wikiId}')` to notify other open tabs of writes; receiving tabs should soft-reload state from the embedded block (or warn the user, depending on whether they have unsaved local changes).

The auto-save loop lives in the Zustand store middleware: every state mutation (excluding transient UI fields like `paletteOpen`, `editingId`) schedules a debounced `persistence.save(state)` call. Debounce 500ms for Tier A, 400ms for Tier B (slightly faster since it's only writing to IDB, not disk).

### 9. Settings drawer

A right-side drawer (slide in, ~320px wide) opened from the top bar. Contains the same controls that are in `tweaks-panel.jsx` (Theme radio, Accent color swatches, Font pair, Layout, Density, Sidebar/Backlinks/Spine toggles) **plus** new sections:

- **Storage**: "Save Wiki" button, "Export markdown ZIP", "Export JSON", file size display, last-saved timestamp.
- **Plugins**: the same plugin toggles from the prototype's sidebar (these are mostly placeholders in the prototype — implement them as real on/off switches that gate features: e.g. `backlinks` plugin actually hides the backlinks panel when off).
- **About**: version, "what is a single-file app" one-liner, link to GitHub (placeholder).

### 10. Empty / first-run state

On first open with no embedded data:
- Show one welcome leaf (the same `welcome` content from `data.js`).
- Generate a fresh `wikiId` (uuid).
- Prompt: "Save your wiki to disk to keep your notes" (toast with Save button).

### 11. Multiple wikis

Since each HTML file is its own wiki, the IndexedDB keys must be scoped by `wikiId`. If a user has two `quire.html` files open in two tabs, drafts must not collide.

---

## Things to NOT do

- Don't add a backend, even an optional one.
- Don't use `localStorage` for the main data — IndexedDB only (localStorage is too small and synchronous).
- Don't pull in heavy libraries: no Slate/ProseMirror/Lexical, no Material UI, no Tailwind. The plain `<textarea>` + custom markdown renderer from the prototype is the editor.
- Don't break the prototype's CSS class names. The CSS is the source of truth; the React tree must produce the same DOM structure with the same classes.
- Don't include the `tweaks-panel.jsx` design tool. Its features migrate into the Settings drawer.
- Don't change the visual design. If you're tempted to "modernize" something, stop — the design is intentional.

---

## Project structure I want

```
quire/
├── index.html                  # vite entry; contains the <script id="quire-data"> block
├── package.json
├── tsconfig.json
├── vite.config.ts              # configured with vite-plugin-singlefile
├── README.md                   # how to build, how to use, how to extend
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles.css              # the entire prototype CSS, ported as-is
│   ├── types.ts
│   ├── store/
│   │   ├── useWikiStore.ts     # zustand store
│   │   └── persistence.ts      # WikiPersistence class
│   ├── lib/
│   │   ├── markdown.tsx        # ported from markdown.jsx
│   │   ├── search.ts           # Fuse.js setup
│   │   ├── wikilinks.ts        # extract/index helpers
│   │   ├── hotkeys.ts          # useHotkey hook
│   │   └── utils.ts            # slug, formatRel, extractTags, extractWikilinks
│   ├── components/
│   │   ├── TopBar.tsx
│   │   ├── Sidebar.tsx
│   │   ├── LeafCard.tsx
│   │   ├── CommandPalette.tsx
│   │   ├── SettingsDrawer.tsx
│   │   ├── Toast.tsx
│   │   └── Icon.tsx
│   └── seed/
│       └── welcome.ts          # the single welcome leaf
└── dist/
    └── quire.html              # the build output — this is the product
```

---

## Build & verify

After implementing:

1. `npm run build` produces `dist/quire.html` as a single file. No other files in `dist/`.
2. Open `dist/quire.html` directly in Chrome, Firefox, and Safari via `file://`. All three must work.

**Persistence acceptance tests** (each must pass for the build to be considered done):

3. **Tier A — Chromium silent auto-save**: Open in Chrome. Click "Connect file" once and pick a location. Type a new leaf. Wait 1 second. Close the tab. Reopen the file from disk. New leaf is there. **No download was triggered. No save dialog appeared after the first connect.**
4. **Tier A — handle persistence**: Repeat #3 but close the entire browser, reboot the machine, then reopen. After at most one re-permission prompt, silent saves resume.
5. **Tier B — Firefox/Safari**: Open in Firefox. Type a new leaf. Status pill shows "Draft · 1 change." Hit `⌘S`. File downloads. Replace the original. Reopen — leaf is there.
6. **Tier B — IndexedDB draft survives crash**: Type a new leaf, do not save. Force-quit the browser. Reopen the file. The "Unsaved changes found — Restore?" prompt appears with the new leaf intact.
7. **Tier B — beforeunload guard**: Type a leaf, do not save, try to close the tab. Browser shows the native "leave site?" prompt. After saving, closing produces no prompt.
8. **Cross-tab coordination**: Open the same file in two tabs. Edit in tab A, save (Tier A) or save (Tier B). Tab B detects the change via BroadcastChannel and either reloads or warns.
9. **Script-tag injection safety**: Create a leaf with the literal body `</script><script>alert('xss')</script>`. Save. Reload. The leaf body is preserved exactly; no alert fires; the page loads cleanly.
10. **Permission denial fallback**: In Chromium, deny the file picker. App downgrades to Tier B without crashing and shows an explanatory toast.

**Functional smoke test** (`tests/smoke.md` — manual checklist):

11. Create leaf → link two leaves with `[[…]]` → verify backlink appears in footer of target leaf.
12. Filter by tag → only matching leaves visible in river → "clear filter" restores.
13. Switch theme paper → ink → mono → all three render correctly.
14. Switch layout river → stack → leaves reflow vertically and center.
15. Command palette: try each mode (no prefix, `>`, `#`, `/`).
16. Save → reload → all settings, open leaves, focused leaf, and content persist.
17. Export markdown ZIP → unzip → verify one `.md` file per leaf with frontmatter.

---

## Deliverables

1. The full project source under `quire/`.
2. A working `dist/quire.html` (the production single-file build).
3. A `README.md` covering: what it is, how to build, how to use, how to back up, browser support notes (especially the FS Access API caveat for Firefox/Safari), and how someone could extend it (e.g. adding a plugin, a new theme, a custom render hook).
4. A short `ARCHITECTURE.md` explaining the save/load loop, the IndexedDB draft flow, and the data hydration sequence on first paint.

---

## Approach

Plan first. Before writing code, lay out:
- The Zustand store shape and actions.
- The persistence sequence (load order on boot, save sequence on `⌘S`).
- A list of every component, top-down, with its props.

Then implement in this order: types → store → persistence → markdown → Icon/TopBar/Sidebar → LeafCard → CommandPalette → SettingsDrawer → wiring → build config → README. Test the save/load loop early; it's the hardest part and the rest of the app depends on it being right.

If you find ambiguities in the prototype, prefer the prototype's behavior over your instinct, and note the question in a `QUESTIONS.md` for me to resolve later.
