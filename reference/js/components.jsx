// Quire — small, reusable UI parts. Loads after data.js + markdown.jsx.

const { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } = React;

// ─── helpers ─────────────────────────────────────────────────────────────────
window.QuireUtil = {
  extractWikilinks(body) {
    const set = new Set();
    const rx = /\[\[([^\]]+?)\]\]/g;
    let m; while ((m = rx.exec(body)) !== null) set.add(m[1].trim());
    return [...set];
  },
  extractTags(body) {
    const set = new Set();
    const rx = /(^|\s)#([a-zA-Z][\w/-]*)/g;
    let m; while ((m = rx.exec(body)) !== null) set.add(m[2]);
    return [...set];
  },
  slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); },
  formatRel(iso) {
    const d = new Date(iso), now = new Date();
    const ms = now - d;
    const min = Math.floor(ms / 60000), hr = Math.floor(min / 60), day = Math.floor(hr / 24);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    if (hr < 24) return `${hr}h ago`;
    if (day < 7) return `${day}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  },
};

// ─── icons (simple, line, no AI-slop bezels) ─────────────────────────────────
const Icon = ({ name, size = 14 }) => {
  const s = { width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    search: <><circle cx="7" cy="7" r="5" /><path d="M11 11l4 4" /></>,
    plus: <><path d="M8 2v12M2 8h12" /></>,
    pin: <><path d="M8 1v6M5 7l3 3 3-3M8 10v5" /></>,
    star: <><path d="M8 1.5l1.9 4 4.4.6-3.2 3 .8 4.4L8 11.4l-3.9 2.1.8-4.4-3.2-3 4.4-.6z" /></>,
    tag: <><path d="M2 2h5l7 7-5 5-7-7z" /><circle cx="5" cy="5" r=".8" fill="currentColor" stroke="none" /></>,
    close: <><path d="M3 3l10 10M13 3L3 13" /></>,
    edit: <><path d="M2 14h12M3 11l7-7 3 3-7 7H3z" /></>,
    eye: <><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" /><circle cx="8" cy="8" r="2" /></>,
    book: <><path d="M2 3h5a2 2 0 0 1 2 2v9a2 2 0 0 0-2-2H2zM14 3H9a2 2 0 0 0-2 2v9a2 2 0 0 1 2-2h5z" /></>,
    river: <><path d="M2 4h12M2 8h12M2 12h12" /></>,
    stack: <><rect x="2" y="2" width="12" height="3" /><rect x="2" y="6.5" width="12" height="3" /><rect x="2" y="11" width="12" height="3" /></>,
    cmd: <><path d="M5 5h6v6H5zM5 5V3a2 2 0 0 0-2 2 2 2 0 0 0 2 2zM11 5V3a2 2 0 0 1 2 2 2 2 0 0 1-2 2zM5 11v2a2 2 0 0 1-2-2 2 2 0 0 1 2-2zM11 11v2a2 2 0 0 0 2-2 2 2 0 0 0-2-2z" /></>,
    chevR: <><path d="M5 3l5 5-5 5" /></>,
    chevD: <><path d="M3 5l5 5 5-5" /></>,
    sun: <><circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" /></>,
    moon: <><path d="M13 9.5A6 6 0 0 1 6.5 3 6 6 0 1 0 13 9.5z" /></>,
    dot: <><circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" /></>,
    drag: <><circle cx="6" cy="4" r=".8" fill="currentColor" stroke="none" /><circle cx="10" cy="4" r=".8" fill="currentColor" stroke="none" /><circle cx="6" cy="8" r=".8" fill="currentColor" stroke="none" /><circle cx="10" cy="8" r=".8" fill="currentColor" stroke="none" /><circle cx="6" cy="12" r=".8" fill="currentColor" stroke="none" /><circle cx="10" cy="12" r=".8" fill="currentColor" stroke="none" /></>,
    link: <><path d="M6 9.5L9.5 6M6 4.5l1-1a3 3 0 0 1 4 4l-1 1M10 11.5l-1 1a3 3 0 0 1-4-4l1-1" /></>,
    arrow: <><path d="M3 8h10M9 4l4 4-4 4" /></>,
    sidebar: <><rect x="2" y="3" width="12" height="10" rx="1" /><path d="M6 3v10" /></>,
    plug: <><path d="M5 1v4M11 1v4M3 5h10v3a5 5 0 0 1-10 0zM8 13v2" /></>,
  };
  return <svg viewBox="0 0 16 16" style={s}>{paths[name]}</svg>;
};

// ─── TopBar ─────────────────────────────────────────────────────────────────
function TopBar({ onCmd, onNew, onToggleTheme, theme, onToggleSidebar, sidebarOpen, count, query, onQueryChange }) {
  return (
    <header className="q-top">
      <div className="q-top-l">
        <button className="q-icon-btn" onClick={onToggleSidebar} title={sidebarOpen ? "Hide index" : "Show index"}>
          <Icon name="sidebar" />
        </button>
        <div className="q-brand">
          <span className="q-brand-mark" />
          <span className="q-brand-name">Quire</span>
          <span className="q-brand-meta">{count} leaves · single file</span>
        </div>
      </div>
      <div className="q-top-c">
        <div className="q-search-pill" onClick={onCmd}>
          <Icon name="search" size={13} />
          <input
            type="text"
            className="q-search-input"
            placeholder="Search, command, or jump…"
            value={query}
            readOnly
          />
          <kbd className="q-kbd">⌘K</kbd>
        </div>
      </div>
      <div className="q-top-r">
        <button className="q-icon-btn" onClick={onToggleTheme} title="Cycle theme">
          <Icon name={theme === "ink" ? "moon" : theme === "mono" ? "dot" : "sun"} />
        </button>
        <button className="q-btn-primary" onClick={onNew}>
          <Icon name="plus" size={11} /> New leaf <kbd className="q-kbd q-kbd-on">⌘N</kbd>
        </button>
      </div>
    </header>
  );
}

// ─── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({
  leaves, openIds, focusedId, onOpen, onJumpToday, todayId,
  tags, activeTag, onTagClick, plugins, onTogglePlugin, recent
}) {
  const pinned = leaves.filter(l => l.pinned);
  return (
    <aside className="q-side">
      <button className="q-today" onClick={onJumpToday}>
        <div className="q-today-date">
          <div className="q-today-mo">MAY</div>
          <div className="q-today-day">8</div>
        </div>
        <div className="q-today-meta">
          <div className="q-today-label">Friday's journal</div>
          <div className="q-today-sub">3 entries · last 16m ago</div>
        </div>
        <Icon name="chevR" size={12} />
      </button>

      <SidebarSection label="Pinned" icon="pin">
        {pinned.map(l => (
          <SideRow key={l.id} active={openIds.includes(l.id)} focused={l.id === focusedId} onClick={() => onOpen(l.id)}>
            {l.title}
          </SideRow>
        ))}
      </SidebarSection>

      <SidebarSection label="Recent" icon="dot">
        {recent.slice(0, 6).map(l => (
          <SideRow key={l.id} active={openIds.includes(l.id)} focused={l.id === focusedId} onClick={() => onOpen(l.id)}>
            <span className="q-side-title">{l.title}</span>
            <span className="q-side-when">{window.QuireUtil.formatRel(l.edited)}</span>
          </SideRow>
        ))}
      </SidebarSection>

      <SidebarSection label="Tags" icon="tag">
        <div className="q-tagcloud">
          {tags.map(([t, n]) => (
            <button
              key={t}
              className={"q-tag-pill" + (activeTag === t ? " q-tag-pill-on" : "")}
              onClick={() => onTagClick(t)}
            >
              <span>{t}</span>
              <span className="q-tag-n">{n}</span>
            </button>
          ))}
        </div>
      </SidebarSection>

      <SidebarSection label="Plugins" icon="plug">
        {plugins.map(p => (
          <button key={p.id} className="q-plug" onClick={() => onTogglePlugin(p.id)}>
            <span className={"q-plug-dot" + (p.on ? " on" : "")} />
            <span className="q-plug-name">{p.name}</span>
            <span className="q-plug-meta">{p.meta}</span>
          </button>
        ))}
      </SidebarSection>

      <div className="q-side-foot">
        <div className="q-side-foot-row">
          <span className="q-side-foot-k">File</span><span className="q-side-foot-v">quire.html · 412 KB</span>
        </div>
        <div className="q-side-foot-row">
          <span className="q-side-foot-k">Saved</span><span className="q-side-foot-v">2s ago, locally</span>
        </div>
      </div>
    </aside>
  );
}

function SidebarSection({ label, icon, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={"q-side-sect" + (open ? "" : " collapsed")}>
      <button className="q-side-h" onClick={() => setOpen(o => !o)}>
        <Icon name={open ? "chevD" : "chevR"} size={10} />
        <span>{label}</span>
      </button>
      {open && <div className="q-side-body">{children}</div>}
    </div>
  );
}

function SideRow({ active, focused, onClick, children }) {
  return (
    <button className={"q-side-row" + (active ? " active" : "") + (focused ? " focused" : "")} onClick={onClick}>
      {children}
    </button>
  );
}

// ─── Card / Leaf ────────────────────────────────────────────────────────────
function LeafCard({
  leaf, focused, isJournal, onFocus, onClose, onWikilink, onTag, onEdit, onChange,
  editing, onToggleEdit, onTogglePin, onMoveLeft, onMoveRight, onDelete, leafIndex, exists,
  showBacklinks, backlinks, dragHandlers
}) {
  const ctx = useMemo(() => ({ exists, onWikilink, onTag }), [exists, onWikilink, onTag]);

  return (
    <article
      className={"q-leaf" + (focused ? " focused" : "") + (isJournal ? " journal" : "") + (editing ? " editing" : "")}
      onClick={onFocus}
      data-leaf-id={leaf.id}
      data-screen-label={`Leaf · ${leaf.title}`}
    >
      <header className="q-leaf-head">
        <div className="q-leaf-handle" {...(dragHandlers || {})}>
          <Icon name="drag" size={12} />
        </div>
        <div className="q-leaf-titlebar">
          {editing ? (
            <input
              className="q-leaf-title-input"
              value={leaf.title}
              onChange={(e) => onChange({ ...leaf, title: e.target.value })}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h2 className="q-leaf-title">{leaf.title}</h2>
          )}
          <div className="q-leaf-meta">
            <span>{window.QuireUtil.formatRel(leaf.edited)}</span>
            {leaf.tags.length > 0 && <span className="q-leaf-meta-sep">·</span>}
            {leaf.tags.slice(0, 4).map(t => (
              <button key={t} className="q-tag-pill q-tag-pill-sm" onClick={(e) => { e.stopPropagation(); onTag(t); }}>
                #{t}
              </button>
            ))}
          </div>
        </div>
        <div className="q-leaf-actions">
          <button className={"q-icon-btn-sm" + (leaf.pinned ? " on" : "")} onClick={(e) => { e.stopPropagation(); onTogglePin(); }} title="Pin">
            <Icon name="pin" size={12} />
          </button>
          <button className={"q-icon-btn-sm" + (editing ? " on" : "")} onClick={(e) => { e.stopPropagation(); onToggleEdit(); }} title="Edit (⌘E)">
            <Icon name={editing ? "eye" : "edit"} size={12} />
          </button>
          <button className="q-icon-btn-sm" onClick={(e) => { e.stopPropagation(); onClose(); }} title="Close (⌘W)">
            <Icon name="close" size={12} />
          </button>
        </div>
      </header>

      <div className="q-leaf-body">
        {editing ? (
          <textarea
            className="q-edit"
            value={leaf.body}
            onChange={(e) => onChange({ ...leaf, body: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            spellCheck={false}
          />
        ) : (
          <div className="q-md">
            {window.QuireMarkdown.render(leaf.body, ctx)}
          </div>
        )}
      </div>

      {focused && showBacklinks && backlinks.length > 0 && !editing && (
        <footer className="q-leaf-foot">
          <div className="q-foot-h">
            <Icon name="link" size={11} />
            <span>{backlinks.length} backlink{backlinks.length === 1 ? "" : "s"}</span>
          </div>
          <div className="q-foot-list">
            {backlinks.map(b => (
              <button key={b.id} className="q-bl-row" onClick={(e) => { e.stopPropagation(); onWikilink(b.title); }}>
                <span className="q-bl-arrow"><Icon name="arrow" size={11} /></span>
                <span className="q-bl-title">{b.title}</span>
                <span className="q-bl-snip">{b.snippet}</span>
              </button>
            ))}
          </div>
        </footer>
      )}

      <div className="q-leaf-spine">
        <span>{String(leafIndex + 1).padStart(2, "0")}</span>
      </div>
    </article>
  );
}

// ─── Command Palette ────────────────────────────────────────────────────────
function CommandPalette({ open, onClose, leaves, onOpen, onNew, onCommand, query, setQuery }) {
  const inputRef = useRef(null);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    if (open) {
      setSel(0);
      setTimeout(() => inputRef.current && inputRef.current.focus(), 10);
    }
  }, [open]);

  const mode = query.startsWith(">") ? "cmd" : query.startsWith("#") ? "tag" : query.startsWith("/") ? "body" : "find";

  const results = useMemo(() => {
    const q = query.replace(/^[>#/]/, "").trim().toLowerCase();
    if (mode === "cmd") {
      const cmds = [
        { id: "cmd:new", label: "New leaf", hint: "⌘N", run: () => onNew() },
        { id: "cmd:theme:paper", label: "Theme: Paper", hint: "set", run: () => onCommand("theme", "paper") },
        { id: "cmd:theme:ink", label: "Theme: Ink", hint: "set", run: () => onCommand("theme", "ink") },
        { id: "cmd:theme:mono", label: "Theme: Mono", hint: "set", run: () => onCommand("theme", "mono") },
        { id: "cmd:layout:river", label: "Layout: River", hint: "set", run: () => onCommand("layout", "river") },
        { id: "cmd:layout:stack", label: "Layout: Stack", hint: "set", run: () => onCommand("layout", "stack") },
        { id: "cmd:export", label: "Export single-file HTML", hint: "save as…", run: () => onCommand("export") },
        { id: "cmd:tweaks", label: "Open Tweaks panel", hint: "⌘.", run: () => onCommand("tweaks") },
      ];
      return cmds.filter(c => !q || c.label.toLowerCase().includes(q));
    }
    if (mode === "tag") {
      return leaves
        .filter(l => l.tags.some(t => t.toLowerCase().includes(q)))
        .slice(0, 12)
        .map(l => ({ id: l.id, label: l.title, hint: l.tags.filter(t => t.toLowerCase().includes(q)).map(t => "#" + t).join(" "), run: () => onOpen(l.id) }));
    }
    if (mode === "body") {
      return leaves
        .map(l => {
          const idx = l.body.toLowerCase().indexOf(q);
          if (idx < 0) return null;
          const snip = l.body.slice(Math.max(0, idx - 20), idx + 60).replace(/\n/g, " ");
          return { id: l.id, label: l.title, hint: "…" + snip + "…", run: () => onOpen(l.id) };
        })
        .filter(Boolean)
        .slice(0, 12);
    }
    // find by title
    if (!q) {
      return leaves.slice(0, 8).map(l => ({ id: l.id, label: l.title, hint: window.QuireUtil.formatRel(l.edited), run: () => onOpen(l.id) }));
    }
    return leaves
      .filter(l => l.title.toLowerCase().includes(q))
      .slice(0, 12)
      .map(l => ({ id: l.id, label: l.title, hint: l.tags.slice(0, 2).map(t => "#" + t).join(" "), run: () => onOpen(l.id) }));
  }, [query, mode, leaves, onOpen, onNew, onCommand]);

  useEffect(() => { setSel(s => Math.min(s, Math.max(0, results.length - 1))); }, [results.length]);

  if (!open) return null;

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(results.length - 1, s + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (results[sel]) { results[sel].run(); onClose(); }
      else if (query.trim()) { onNew(query.trim()); onClose(); }
    } else if (e.key === "Escape") { onClose(); }
  };

  return (
    <div className="q-palette-scrim" onClick={onClose}>
      <div className="q-palette" onClick={(e) => e.stopPropagation()}>
        <div className="q-palette-row">
          <Icon name={mode === "cmd" ? "cmd" : mode === "tag" ? "tag" : mode === "body" ? "search" : "search"} />
          <input
            ref={inputRef}
            className="q-palette-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Type to find · > command · # tag · / search bodies"
          />
          <span className="q-palette-mode">{mode}</span>
        </div>
        <div className="q-palette-list">
          {results.map((r, i) => (
            <div key={r.id} className={"q-palette-item" + (i === sel ? " sel" : "")}
                 onMouseEnter={() => setSel(i)}
                 onClick={() => { r.run(); onClose(); }}>
              <span className="q-palette-label">{r.label}</span>
              <span className="q-palette-hint">{r.hint}</span>
            </div>
          ))}
          {results.length === 0 && (
            <div className="q-palette-empty">
              <span>No matches.</span>
              <kbd>Enter</kbd>
              <span>to create "<b>{query.replace(/^[>#/]/, "").trim() || "Untitled"}</b>"</span>
            </div>
          )}
        </div>
        <div className="q-palette-foot">
          <span><kbd>↑↓</kbd> move</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
          <span style={{ marginLeft: "auto" }}>{results.length} match{results.length === 1 ? "" : "es"}</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Icon, TopBar, Sidebar, SidebarSection, SideRow, LeafCard, CommandPalette });
