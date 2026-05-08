import { ReactNode, useState } from 'react';
import { Icon, IconName } from './Icon';
import type { Leaf, LeafID } from '../types';
import { formatRel } from '../lib/utils';

interface SidebarProps {
  leaves: Leaf[];
  openIds: LeafID[];
  focusedId: LeafID | null;
  onOpen: (id: LeafID) => void;
  onJumpToday: () => void;
  todayId: LeafID | null;
  tags: [string, number][];
  activeTag: string | null;
  onTagClick: (t: string) => void;
  recent: Leaf[];
  fileSizeText: string;
  savedText: string;
}

export function Sidebar({
  leaves,
  openIds,
  focusedId,
  onOpen,
  onJumpToday,
  todayId,
  tags,
  activeTag,
  onTagClick,
  recent,
  fileSizeText,
  savedText,
}: SidebarProps) {
  const pinned = leaves.filter((l) => l.pinned);
  const today = new Date();
  const monthLabel = today.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
  const dayLabel = String(today.getDate());
  const journalCount = leaves.filter((l) => l.isJournal).length;
  const lastJournalEdit = leaves.filter((l) => l.isJournal).sort((a, b) => (b.edited > a.edited ? 1 : -1))[0];

  return (
    <aside className="q-side">
      <button className="q-today" onClick={onJumpToday} disabled={!todayId}>
        <div className="q-today-date">
          <div className="q-today-mo">{monthLabel}</div>
          <div className="q-today-day">{dayLabel}</div>
        </div>
        <div className="q-today-meta">
          <div className="q-today-label">Today's journal</div>
          <div className="q-today-sub">
            {journalCount} {journalCount === 1 ? 'entry' : 'entries'}
            {lastJournalEdit ? ` · last ${formatRel(lastJournalEdit.edited)}` : ''}
          </div>
        </div>
        <Icon name="chevR" size={12} />
      </button>

      {pinned.length > 0 && (
        <SidebarSection label="Pinned" icon="pin">
          {pinned.map((l) => (
            <SideRow
              key={l.id}
              active={openIds.includes(l.id)}
              focused={l.id === focusedId}
              onClick={() => onOpen(l.id)}
            >
              {l.title}
            </SideRow>
          ))}
        </SidebarSection>
      )}

      <SidebarSection label="Recent" icon="dot">
        {recent.slice(0, 6).map((l) => (
          <SideRow
            key={l.id}
            active={openIds.includes(l.id)}
            focused={l.id === focusedId}
            onClick={() => onOpen(l.id)}
          >
            <span className="q-side-title">{l.title}</span>
            <span className="q-side-when">{formatRel(l.edited)}</span>
          </SideRow>
        ))}
      </SidebarSection>

      {tags.length > 0 && (
        <SidebarSection label="Tags" icon="tag">
          <div className="q-tagcloud">
            {tags.map(([t, n]) => (
              <button
                key={t}
                className={'q-tag-pill' + (activeTag === t ? ' q-tag-pill-on' : '')}
                onClick={() => onTagClick(t)}
              >
                <span>{t}</span>
                <span className="q-tag-n">{n}</span>
              </button>
            ))}
          </div>
        </SidebarSection>
      )}

      <div className="q-side-foot">
        <div className="q-side-foot-row">
          <span className="q-side-foot-k">File</span>
          <span className="q-side-foot-v">{fileSizeText}</span>
        </div>
        <div className="q-side-foot-row">
          <span className="q-side-foot-k">Saved</span>
          <span className="q-side-foot-v">{savedText}</span>
        </div>
      </div>
    </aside>
  );
}

function SidebarSection({
  label,
  icon,
  children,
}: {
  label: string;
  icon: IconName;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className={'q-side-sect' + (open ? '' : ' collapsed')}>
      <button className="q-side-h" onClick={() => setOpen((o) => !o)}>
        <Icon name={open ? 'chevD' : 'chevR'} size={10} />
        <span>{label}</span>
      </button>
      {open && <div className="q-side-body">{children}</div>}
    </div>
  );
}

function SideRow({
  active,
  focused,
  onClick,
  children,
}: {
  active?: boolean;
  focused?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className={'q-side-row' + (active ? ' active' : '') + (focused ? ' focused' : '')}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
