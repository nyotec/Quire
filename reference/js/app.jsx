// Quire — main app. Loads after data.js, markdown.jsx, components.jsx, tweaks-panel.jsx.

const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ─── derive ──────────────────────────────────────────────────────────────────
function buildIndex(leaves) {
  const byId = new Map(); const byTitle = new Map();
  for (const l of leaves) { byId.set(l.id, l); byTitle.set(l.title.toLowerCase(), l); }
  // forward & back links
  const forward = new Map(), back = new Map();
  for (const l of leaves) {
    const ts = window.QuireUtil.extractWikilinks(l.body);
    forward.set(l.id, []);
    for (const t of ts) {
      const tgt = byTitle.get(t.toLowerCase());
      if (tgt) {
        forward.get(l.id).push(tgt.id);
        if (!back.has(tgt.id)) back.set(tgt.id, []);
        const rx = new RegExp("([^.\n]*\\[\\[" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\]\\][^.\n]*)", "i");
        const m = l.body.match(rx);
        const snippet = (m ? m[1] : "").trim().replace(/\s+/g, " ").slice(0, 120);
        back.get(tgt.id).push({ id: l.id, title: l.title, snippet });
      }
    }
  }
  return { byId, byTitle, forward, back };
}

function tagCounts(leaves) {
  const m = new Map();
  for (const l of leaves) for (const t of l.tags) m.set(t, (m.get(t) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// ─── App ─────────────────────────────────────────────────────────────────────
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "paper",
  "accent": "ochre",
  "fontPair": "editorial",
  "density": "regular",
  "layout": "river",
  "sidebar": true,
  "backlinks": true,
  "spineNumbers": true
}/*EDITMODE-END*/;

const ACCENTS = {
  ochre:  "oklch(0.62 0.12 70)",
  sage:   "oklch(0.58 0.08 150)",
  indigo: "oklch(0.55 0.12 280)",
  rust:   "oklch(0.55 0.14 30)",
  plum:   "oklch(0.5  0.12 330)",
};

const FONT_PAIRS = {
  editorial: { head: '"Spectral", Georgia, serif', body: '"IBM Plex Sans", system-ui, sans-serif', mono: '"JetBrains Mono", ui-monospace, monospace' },
  modern:    { head: '"IBM Plex Sans", system-ui, sans-serif', body: '"IBM Plex Sans", system-ui, sans-serif', mono: '"JetBrains Mono", ui-monospace, monospace' },
  classic:   { head: '"Spectral", Georgia, serif', body: '"Spectral", Georgia, serif', mono: '"IBM Plex Mono", ui-monospace, monospace' },
  terminal:  { head: '"JetBrains Mono", ui-monospace, monospace', body: '"JetBrains Mono", ui-monospace, monospace', mono: '"JetBrains Mono", ui-monospace, monospace' },
};

const THEMES = {
  paper: {
    "--q-bg": "#f5efe2",
    "--q-bg-2": "#efe7d4",
    "--q-surface": "#fdfaf2",
    "--q-surface-2": "#f9f3e3",
    "--q-ink": "#2b2620",
    "--q-ink-2": "#574e42",
    "--q-dim": "#8c8474",
    "--q-line": "#e6dec9",
    "--q-line-2": "#d6cdb6",
    "--q-shadow": "0 1px 0 rgba(255,255,255,.6) inset, 0 1px 2px rgba(60,40,10,.06), 0 18px 40px -22px rgba(60,40,10,.18)",
    "--q-shadow-focused": "0 1px 0 rgba(255,255,255,.7) inset, 0 2px 4px rgba(60,40,10,.08), 0 24px 50px -22px rgba(60,40,10,.28)",
    "--q-paper-grain": "0",
  },
  ink: {
    "--q-bg": "#14130f",
    "--q-bg-2": "#0e0d0a",
    "--q-surface": "#1c1a15",
    "--q-surface-2": "#23201a",
    "--q-ink": "#ece5d4",
    "--q-ink-2": "#b9b09a",
    "--q-dim": "#7a7264",
    "--q-line": "#2a2620",
    "--q-line-2": "#3a342b",
    "--q-shadow": "0 1px 0 rgba(255,255,255,.04) inset, 0 18px 40px -22px rgba(0,0,0,.6)",
    "--q-shadow-focused": "0 1px 0 rgba(255,255,255,.06) inset, 0 24px 50px -22px rgba(0,0,0,.8)",
    "--q-paper-grain": "0",
  },
  mono: {
    "--q-bg": "#ffffff",
    "--q-bg-2": "#fafafa",
    "--q-surface": "#ffffff",
    "--q-surface-2": "#f7f7f7",
    "--q-ink": "#0b0b0b",
    "--q-ink-2": "#3a3a3a",
    "--q-dim": "#888888",
    "--q-line": "#0b0b0b",
    "--q-line-2": "#cfcfcf",
    "--q-shadow": "none",
    "--q-shadow-focused": "0 0 0 1.5px #0b0b0b",
    "--q-paper-grain": "0",
  },
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // ─ leaves state ───────────────────────────────────────────────────────────
  const [leaves, setLeaves] = useState(window.SEED_LEAVES);
  const [openIds, setOpenIds] = useState(window.SEED_OPEN);
  const [focusedId, setFocusedId] = useState(window.SEED_OPEN[0]);
  const [editingId, setEditingId] = useState(null);

  const index = useMemo(() => buildIndex(leaves), [leaves]);
  const tags = useMemo(() => tagCounts(leaves), [leaves]);
  const recent = useMemo(() => [...leaves].sort((a, b) => (b.edited > a.edited ? 1 : -1)), [leaves]);

  // ─ palette / search ───────────────────────────────────────────────────────
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");

  // ─ tag filter ─────────────────────────────────────────────────────────────
  const [activeTag, setActiveTag] = useState(null);

  // ─ plugins ────────────────────────────────────────────────────────────────
  const [plugins, setPlugins] = useState([
    { id: "backlinks", name: "Backlinks", meta: "built-in", on: true },
    { id: "graph", name: "Graph view", meta: "built-in", on: false },
    { id: "math", name: "Math (KaTeX)", meta: "built-in", on: false },
    { id: "code", name: "Code highlight", meta: "built-in", on: true },
    { id: "wordcount", name: "Word count", meta: "snippet", on: false },
    { id: "darkjournal", name: "Dark journal", meta: "snippet", on: false },
  ]);
  const togglePlugin = (id) => setPlugins(ps => ps.map(p => p.id === id ? { ...p, on: !p.on } : p));

  // ─ ops ────────────────────────────────────────────────────────────────────
  const openLeaf = useCallback((id) => {
    setOpenIds(ids => ids.includes(id) ? ids : [...ids, id]);
    setFocusedId(id);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-leaf-id="${id}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    });
  }, []);

  const closeLeaf = useCallback((id) => {
    setOpenIds(ids => {
      const i = ids.indexOf(id); if (i < 0) return ids;
      const next = ids.filter(x => x !== id);
      if (focusedId === id) setFocusedId(next[Math.max(0, i - 1)] || next[0] || null);
      return next;
    });
    setEditingId(eid => eid === id ? null : eid);
  }, [focusedId]);

  const moveLeaf = (id, dir) => {
    setOpenIds(ids => {
      const i = ids.indexOf(id); if (i < 0) return ids;
      const j = Math.max(0, Math.min(ids.length - 1, i + dir));
      if (i === j) return ids;
      const next = [...ids]; [next[i], next[j]] = [next[j], next[i]]; return next;
    });
  };

  const updateLeaf = (next) => {
    setLeaves(ls => ls.map(l => l.id === next.id ? { ...next, edited: new Date().toISOString(), tags: window.QuireUtil.extractTags(next.body).length ? window.QuireUtil.extractTags(next.body) : next.tags } : l));
  };

  const togglePin = (id) => setLeaves(ls => ls.map(l => l.id === id ? { ...l, pinned: !l.pinned } : l));

  const newLeaf = (title) => {
    const t = (title || "Untitled").trim();
    const id = window.QuireUtil.slug(t) + "-" + Math.random().toString(36).slice(2, 6);
    const now = new Date().toISOString();
    const leaf = { id, title: t, tags: [], created: now, edited: now, body: "" };
    setLeaves(ls => [leaf, ...ls]);
    setOpenIds(ids => [id, ...ids]);
    setFocusedId(id);
    setEditingId(id);
    setPaletteOpen(false);
  };

  const onWikilink = useCallback((target) => {
    const tgt = index.byTitle.get(target.toLowerCase());
    if (tgt) openLeaf(tgt.id);
    else newLeaf(target);
  }, [index, openLeaf]);

  const onTagClick = useCallback((tag) => {
    setActiveTag(prev => prev === tag ? null : tag);
  }, []);

  const cycleTheme = () => setTweak("theme", t.theme === "paper" ? "ink" : t.theme === "ink" ? "mono" : "paper");

  // ─ shortcuts ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(true); setPaletteQuery(""); }
      else if (meta && e.key.toLowerCase() === "n") { e.preventDefault(); newLeaf(""); }
      else if (meta && e.key.toLowerCase() === "e" && focusedId) { e.preventDefault(); setEditingId(eid => eid === focusedId ? null : focusedId); }
      else if (meta && e.key.toLowerCase() === "w" && focusedId) { e.preventDefault(); closeLeaf(focusedId); }
      else if (meta && e.key === "[" && focusedId) { e.preventDefault(); moveLeaf(focusedId, -1); }
      else if (meta && e.key === "]" && focusedId) { e.preventDefault(); moveLeaf(focusedId, 1); }
      else if (e.key === "Escape") { setPaletteOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedId, closeLeaf]);

  const onCommand = (cmd, val) => {
    if (cmd === "theme") setTweak("theme", val);
    else if (cmd === "layout") setTweak("layout", val);
    else if (cmd === "tweaks") window.parent.postMessage({ type: "__activate_edit_mode" }, "*");
    else if (cmd === "export") alert("In a real Quire, this saves the current state of every leaf into the HTML you're reading and offers it as a download.");
  };

  // ─ open river ─────────────────────────────────────────────────────────────
  let openLeaves = openIds.map(id => index.byId.get(id)).filter(Boolean);
  if (activeTag) openLeaves = openLeaves.filter(l => l.tags.includes(activeTag));

  // ─ drag reorder (open river) ──────────────────────────────────────────────
  const [draggingId, setDraggingId] = useState(null);
  const dragHandlers = (id) => ({
    draggable: true,
    onDragStart: (e) => { setDraggingId(id); e.dataTransfer.effectAllowed = "move"; },
    onDragOver: (e) => { if (draggingId && draggingId !== id) e.preventDefault(); },
    onDrop: (e) => {
      e.preventDefault();
      if (!draggingId || draggingId === id) return;
      setOpenIds(ids => {
        const a = ids.indexOf(draggingId), b = ids.indexOf(id);
        if (a < 0 || b < 0) return ids;
        const next = [...ids]; next.splice(a, 1); next.splice(b, 0, draggingId); return next;
      });
      setDraggingId(null);
    },
    onDragEnd: () => setDraggingId(null),
  });

  // ─ style vars ─────────────────────────────────────────────────────────────
  const theme = THEMES[t.theme] || THEMES.paper;
  const fonts = FONT_PAIRS[t.fontPair] || FONT_PAIRS.editorial;
  const accent = ACCENTS[t.accent] || ACCENTS.ochre;
  const dens = t.density === "compact" ? { pad: 18, w: 380, gap: 14, leading: 1.55 } :
               t.density === "comfy"   ? { pad: 32, w: 540, gap: 24, leading: 1.78 } :
                                         { pad: 24, w: 460, gap: 18, leading: 1.65 };

  const cssVars = {
    ...theme,
    "--q-accent": accent,
    "--q-font-head": fonts.head,
    "--q-font-body": fonts.body,
    "--q-font-mono": fonts.mono,
    "--q-pad": dens.pad + "px",
    "--q-leaf-w": dens.w + "px",
    "--q-gap": dens.gap + "px",
    "--q-leading": dens.leading,
  };

  const focusedBacklinks = focusedId ? (index.back.get(focusedId) || []) : [];
  const showBacklinks = t.backlinks && plugins.find(p => p.id === "backlinks").on;
  const todayId = leaves.find(l => l.isJournal)?.id;

  return (
    <div
      className={`q-app q-theme-${t.theme} q-layout-${t.layout}` + (t.sidebar ? "" : " q-no-side")}
      style={cssVars}
    >
      <TopBar
        onCmd={() => { setPaletteOpen(true); setPaletteQuery(""); }}
        onNew={() => newLeaf("")}
        onToggleTheme={cycleTheme}
        theme={t.theme}
        onToggleSidebar={() => setTweak("sidebar", !t.sidebar)}
        sidebarOpen={t.sidebar}
        count={leaves.length}
        query={activeTag ? `filtered: #${activeTag}` : ""}
        onQueryChange={() => {}}
      />

      <div className="q-shell">
        {t.sidebar && (
          <Sidebar
            leaves={leaves}
            openIds={openIds}
            focusedId={focusedId}
            onOpen={openLeaf}
            onJumpToday={() => todayId && openLeaf(todayId)}
            todayId={todayId}
            tags={tags}
            activeTag={activeTag}
            onTagClick={onTagClick}
            plugins={plugins}
            onTogglePlugin={togglePlugin}
            recent={recent}
          />
        )}

        <main className={`q-main`}>
          {activeTag && (
            <div className="q-filter-bar">
              <span>Showing leaves tagged <b>#{activeTag}</b> · {openLeaves.length} open · {leaves.filter(l => l.tags.includes(activeTag)).length} total</span>
              <button onClick={() => setActiveTag(null)}>clear filter</button>
            </div>
          )}

          <div className={`q-river q-river-${t.layout}`}>
            {openLeaves.length === 0 && (
              <div className="q-empty">
                <div className="q-empty-mark" />
                <h3>The river is dry.</h3>
                <p>Press <kbd>⌘K</kbd> to find a leaf, or <kbd>⌘N</kbd> to write a new one.</p>
              </div>
            )}
            {openLeaves.map((leaf, idx) => (
              <LeafCard
                key={leaf.id}
                leaf={leaf}
                leafIndex={idx}
                focused={focusedId === leaf.id}
                isJournal={leaf.isJournal}
                onFocus={() => setFocusedId(leaf.id)}
                onClose={() => closeLeaf(leaf.id)}
                onWikilink={onWikilink}
                onTag={onTagClick}
                onChange={updateLeaf}
                editing={editingId === leaf.id}
                onToggleEdit={() => setEditingId(eid => eid === leaf.id ? null : leaf.id)}
                onTogglePin={() => togglePin(leaf.id)}
                onMoveLeft={() => moveLeaf(leaf.id, -1)}
                onMoveRight={() => moveLeaf(leaf.id, 1)}
                exists={(t) => index.byTitle.has(t.toLowerCase())}
                showBacklinks={showBacklinks}
                backlinks={index.back.get(leaf.id) || []}
                dragHandlers={dragHandlers(leaf.id)}
              />
            ))}
            <div className="q-river-end" />
          </div>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        leaves={leaves}
        onOpen={openLeaf}
        onNew={newLeaf}
        onCommand={onCommand}
        query={paletteQuery}
        setQuery={setPaletteQuery}
      />

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakRadio label="Mode" value={t.theme} options={["paper", "ink", "mono"]} onChange={(v) => setTweak("theme", v)} />
        <TweakColor label="Accent" value={t.accent}
          options={["ochre", "sage", "indigo", "rust", "plum"]}
          onChange={(v) => setTweak("accent", v)}
        />

        <TweakSection label="Type" />
        <TweakSelect label="Pairing" value={t.fontPair}
          options={["editorial", "modern", "classic", "terminal"]}
          onChange={(v) => setTweak("fontPair", v)}
        />

        <TweakSection label="Layout" />
        <TweakRadio label="Flow" value={t.layout} options={["river", "stack"]} onChange={(v) => setTweak("layout", v)} />
        <TweakRadio label="Density" value={t.density} options={["compact", "regular", "comfy"]} onChange={(v) => setTweak("density", v)} />
        <TweakToggle label="Sidebar" value={t.sidebar} onChange={(v) => setTweak("sidebar", v)} />
        <TweakToggle label="Backlinks panel" value={t.backlinks} onChange={(v) => setTweak("backlinks", v)} />
        <TweakToggle label="Spine numbers" value={t.spineNumbers} onChange={(v) => setTweak("spineNumbers", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
