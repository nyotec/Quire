import { ReactNode, useMemo, useState } from 'react';
import { Icon, IconName } from './Icon';
import type { ActiveFilter, Folder, FolderID, Leaf, LeafID, User, UserID } from '../types';
import { formatRel } from '../lib/utils';
import {
  TaskCounts,
  TaskInfo,
  allTasks,
  computeCounts,
  sortTasks,
} from '../lib/tasks';
import { FolderTree } from './FolderTree';

interface SidebarProps {
  leaves: Leaf[];
  openIds: LeafID[];
  focusedId: LeafID | null;
  onOpen: (id: LeafID) => void;
  onJumpToday: () => void;
  todayId: LeafID | null;
  tags: [string, number][];
  activeFilter: ActiveFilter;
  onTagClick: (t: string) => void;
  onAuthorClick: (id: UserID) => void;
  recent: Leaf[];
  fileSizeText: string;
  savedText: string;
  people: { user: User; count: number }[];
  currentUserId: UserID | null;
  onOpenTasks: () => void;
  showOverdueBadge: boolean;
  folders: Folder[];
  onFolderFilter: (id: FolderID | null, deep: boolean) => void;
  onFolderCreate: (parentId: FolderID | null) => void;
  onFolderContextMenu: (folder: Folder, evt: { x: number; y: number }) => void;
  showLeafCounts: boolean;
}

export function Sidebar({
  leaves,
  openIds,
  focusedId,
  onOpen,
  onJumpToday,
  todayId,
  tags,
  activeFilter,
  onTagClick,
  onAuthorClick,
  recent,
  fileSizeText,
  savedText,
  people,
  currentUserId,
  onOpenTasks,
  showOverdueBadge,
  folders,
  onFolderFilter,
  onFolderCreate,
  onFolderContextMenu,
  showLeafCounts,
}: SidebarProps) {
  const activeTag = activeFilter?.type === 'tag' ? activeFilter.value : null;
  const activeAuthor = activeFilter?.type === 'author' ? activeFilter.value : null;
  const pinned = leaves.filter((l) => l.pinned);
  const tasks = useMemo(() => allTasks(leaves), [leaves]);
  const taskCounts: TaskCounts = useMemo(() => computeCounts(tasks), [tasks]);
  const upcoming = useMemo(() => {
    const open = tasks.filter(
      (t) => !t.done && t.dueDate,
    );
    return sortTasks(open, 'due')
      .filter((t) => {
        // Only show due-today and overdue items in the mini list.
        const today = new Date().toISOString().slice(0, 10);
        return t.dueDate && t.dueDate <= today;
      })
      .slice(0, 5);
  }, [tasks]);
  const today = new Date();
  const monthLabel = today.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
  const dayLabel = String(today.getDate());
  const journalCount = leaves.filter((l) => l.isJournal).length;
  const lastJournalEdit = leaves.filter((l) => l.isJournal).sort((a, b) => (b.edited > a.edited ? 1 : -1))[0];

  return (
    <aside className="q-side">
      <button className="q-sidebar-tasks" onClick={onOpenTasks}>
        <div className="q-sidebar-tasks-icon">☐</div>
        <div className="q-sidebar-tasks-meta">
          <div className="q-sidebar-tasks-label">Tasks</div>
          <div className="q-sidebar-tasks-sub">
            {taskCounts.dueToday > 0
              ? `${taskCounts.dueToday} due today · `
              : ''}
            {taskCounts.open} open
          </div>
        </div>
        {showOverdueBadge && taskCounts.overdue > 0 && (
          <span className="q-sidebar-tasks-badge">{taskCounts.overdue}</span>
        )}
      </button>

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

      {people.length > 0 && (
        <SidebarSection label="People" icon="dot">
          {people.map(({ user, count }) => (
            <button
              key={user.id}
              className={'q-people-row' + (activeAuthor === user.id ? ' active' : '')}
              onClick={() => onAuthorClick(user.id)}
            >
              <span className="q-people-dot" style={{ background: user.color }} />
              <span className="q-people-name">
                {user.name}
                {user.id === currentUserId && <span className="q-people-you">→ you</span>}
              </span>
              <span className="q-people-count">{count}</span>
            </button>
          ))}
        </SidebarSection>
      )}

      <SidebarSection label="Folders" icon="book">
        <FolderTree
          folders={folders}
          leaves={leaves}
          activeFilter={activeFilter}
          onFilterFolder={onFolderFilter}
          onCreateFolder={onFolderCreate}
          onContextMenu={onFolderContextMenu}
          showLeafCounts={showLeafCounts}
        />
      </SidebarSection>

      {upcoming.length > 0 && (
        <SidebarSection label="Upcoming" icon="check">
          {upcoming.map((t) => (
            <button
              key={`${t.leafId}:${t.sourceLine}`}
              className="q-upcoming-row"
              onClick={() => onOpen(t.leafId)}
              title={t.text}
            >
              <span className="q-upcoming-text">{t.text || '(empty)'}</span>
              <span
                className={
                  'q-due ' +
                  (t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10)
                    ? 'q-due-overdue'
                    : 'q-due-today')
                }
              >
                {t.dueDate &&
                  (t.dueDate < new Date().toISOString().slice(0, 10) ? 'overdue' : 'today')}
              </span>
            </button>
          ))}
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
