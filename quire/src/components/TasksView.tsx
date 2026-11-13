import { useMemo, useState } from 'react';
import type { DateFormat, LeafID, User, UserID } from '../types';
import {
  TaskInfo,
  TaskSort,
  allTasks,
  computeCounts,
  sortTasks,
  toggleTaskOnLine,
} from '../lib/tasks';
import { useWikiStore } from '../store/useWikiStore';
import { bodyAsString } from '../lib/lockState';
import { isLeafAccessible } from '../lib/folderCrypto';
import { Icon } from './Icon';
import { TaskRow } from './TaskRow';

interface Props {
  focused: boolean;
  leafIndex: number;
  onClose: () => void;
  onOpenLeaf: (id: LeafID) => void;
  onWikilink: (target: string) => void;
  onTag: (tag: string) => void;
  exists: (title: string) => boolean;
  getUser: (id: UserID | null | undefined) => User | null;
  dateFormat: DateFormat;
  spineNumbers: boolean;
}

type Filter = 'open' | 'done' | 'all';

export function TasksView({
  focused,
  leafIndex,
  onClose,
  onOpenLeaf,
  onWikilink,
  onTag,
  exists,
  getUser,
  dateFormat,
  spineNumbers,
}: Props) {
  const leaves = useWikiStore((s) => s.leaves);
  const updateLeafBody = useWikiStore((s) => s.updateLeafBody);

  const [filter, setFilter] = useState<Filter>('open');
  const [requireDueDate, setRequireDueDate] = useState(false);
  const [sort, setSort] = useState<TaskSort | 'date'>('date');

  const folders = useWikiStore((s) => s.folders);
  const visibleLeaves = useMemo(
    () => leaves.filter((l) => isLeafAccessible(folders, l)),
    [leaves, folders],
  );
  const lockedCount = leaves.length - visibleLeaves.length;
  const tasks = useMemo(() => allTasks(visibleLeaves), [visibleLeaves]);
  const counts = useMemo(() => computeCounts(tasks), [tasks]);

  const visible = useMemo(() => {
    let t = tasks;
    if (filter === 'open') t = t.filter((x) => !x.done);
    else if (filter === 'done') t = t.filter((x) => x.done);
    if (requireDueDate) t = t.filter((x) => !!x.dueDate);
    if (sort === 'date') {
      // Ascending by effective date (due date, else the task's leaf day).
      return [...t].sort((a, b) =>
        taskDateKey(a) < taskDateKey(b) ? -1 : taskDateKey(a) > taskDateKey(b) ? 1 : 0,
      );
    }
    return sortTasks(t, sort);
  }, [tasks, filter, requireDueDate, sort]);

  const onToggle = (task: TaskInfo) => {
    const leaf = leaves.find((l) => l.id === task.leafId);
    if (!leaf) return;
    const next = toggleTaskOnLine(bodyAsString(leaf), task.sourceLine);
    if (next !== null) updateLeafBody(leaf.id, next);
  };

  return (
    <article
      className={'q-leaf q-leaf-tasks' + (focused ? ' focused' : '')}
      data-screen-label="Tasks"
    >
      <header className="q-leaf-head">
        <div className="q-leaf-handle" aria-hidden="true">
          <Icon name="check" size={12} />
        </div>
        <div className="q-leaf-titlebar">
          <h2 className="q-leaf-title">Tasks</h2>
          <div className="q-tasks-summary">
            {counts.open} open · {counts.dueToday} due today · {counts.overdue} overdue ·{' '}
            {counts.done} done
          </div>
        </div>
        <div className="q-leaf-actions">
          <button className="q-icon-btn-sm" onClick={onClose} title="Close (⌘⇧T)">
            <Icon name="close" size={12} />
          </button>
        </div>
      </header>

      <div className="q-leaf-body">
        {lockedCount > 0 && (
          <div className="q-tasks-locked-banner">
            🔒 {lockedCount} {lockedCount === 1 ? 'leaf is' : 'leaves are'} in
            locked folders. Tasks from those leaves are hidden until you unlock.
          </div>
        )}
        <div className="q-tasks-controls">
          <div className="q-tasks-seg">
            {(['open', 'done', 'all'] as Filter[]).map((f) => (
              <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
          <label className="q-tasks-toggle-row">
            <input
              type="checkbox"
              checked={requireDueDate}
              onChange={(e) => setRequireDueDate(e.target.checked)}
            />
            Has due date only
          </label>
          <div className="q-tasks-seg" style={{ marginLeft: 'auto' }}>
            {(
              [
                ['date', 'By date'],
                ['due', 'Due'],
                ['created', 'Created'],
                ['leaf', 'By leaf'],
              ] as [TaskSort | 'date', string][]
            ).map(([k, label]) => (
              <button key={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="q-tasks-empty">
            No tasks yet. Write <code className="q-code-i">- [ ] something</code> in any leaf to start.
          </div>
        ) : visible.length === 0 ? (
          <div className="q-tasks-empty">No matching tasks.</div>
        ) : sort === 'date' ? (
          <GroupedByDate
            tasks={visible}
            getUser={getUser}
            dateFormat={dateFormat}
            exists={exists}
            onWikilink={onWikilink}
            onTag={onTag}
            onToggle={onToggle}
            onOpenLeaf={onOpenLeaf}
          />
        ) : sort === 'leaf' ? (
          <GroupedByLeaf
            tasks={visible}
            getUser={getUser}
            dateFormat={dateFormat}
            exists={exists}
            onWikilink={onWikilink}
            onTag={onTag}
            onToggle={onToggle}
            onOpenLeaf={onOpenLeaf}
          />
        ) : (
          <div className="q-tasks-list">
            {visible.map((t) => (
              <TaskRow
                key={`${t.leafId}:${t.sourceLine}`}
                task={t}
                author={getUser(t.authorId)}
                dateFormat={dateFormat}
                exists={exists}
                onToggle={() => onToggle(t)}
                onWikilink={onWikilink}
                onTag={onTag}
                onOpenSource={() => onOpenLeaf(t.leafId)}
              />
            ))}
          </div>
        )}
      </div>

      {spineNumbers && (
        <div className="q-leaf-spine">
          <span>{String(leafIndex + 1).padStart(2, '0')}</span>
        </div>
      )}
    </article>
  );
}

function GroupedByLeaf({
  tasks,
  getUser,
  dateFormat,
  exists,
  onWikilink,
  onTag,
  onToggle,
  onOpenLeaf,
}: {
  tasks: TaskInfo[];
  getUser: (id: UserID | null | undefined) => User | null;
  dateFormat: DateFormat;
  exists: (title: string) => boolean;
  onWikilink: (target: string) => void;
  onTag: (tag: string) => void;
  onToggle: (t: TaskInfo) => void;
  onOpenLeaf: (id: LeafID) => void;
}) {
  const groups = useMemo(() => {
    const m = new Map<string, TaskInfo[]>();
    for (const t of tasks) {
      const key = t.leafId;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(t);
    }
    return Array.from(m.entries());
  }, [tasks]);
  return (
    <div className="q-tasks-list">
      {groups.map(([leafId, list]) => (
        <div key={leafId}>
          <div className="q-tasks-group-h">{list[0].leafTitle}</div>
          {list.map((t) => (
            <TaskRow
              key={`${t.leafId}:${t.sourceLine}`}
              task={t}
              author={getUser(t.authorId)}
              dateFormat={dateFormat}
              exists={exists}
              onToggle={() => onToggle(t)}
              onWikilink={onWikilink}
              onTag={onTag}
              onOpenSource={() => onOpenLeaf(t.leafId)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Local YYYY-MM-DD for an ISO timestamp. */
function dayKeyLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The date a task is segregated under: its due date, else its leaf's day. */
function taskDateKey(t: TaskInfo): string {
  return t.dueDate || dayKeyLocal(t.leafCreated);
}

/** Friendly header for a YYYY-MM-DD bucket (Today / Tomorrow / Yesterday / date). */
function dateHeaderLabel(key: string): string {
  const today = dayKeyLocal(new Date().toISOString());
  const d = new Date(key + 'T00:00:00');
  const nice = d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (key === today) return `Today · ${nice}`;
  const oneDay = 86400000;
  const base = new Date(today + 'T00:00:00').getTime();
  const diff = Math.round((new Date(key + 'T00:00:00').getTime() - base) / oneDay);
  if (diff === 1) return `Tomorrow · ${nice}`;
  if (diff === -1) return `Yesterday · ${nice}`;
  if (diff < 0) return `${nice} · overdue`;
  return nice;
}

function GroupedByDate({
  tasks,
  getUser,
  dateFormat,
  exists,
  onWikilink,
  onTag,
  onToggle,
  onOpenLeaf,
}: {
  tasks: TaskInfo[];
  getUser: (id: UserID | null | undefined) => User | null;
  dateFormat: DateFormat;
  exists: (title: string) => boolean;
  onWikilink: (target: string) => void;
  onTag: (tag: string) => void;
  onToggle: (t: TaskInfo) => void;
  onOpenLeaf: (id: LeafID) => void;
}) {
  const groups = useMemo(() => {
    const m = new Map<string, TaskInfo[]>();
    for (const t of tasks) {
      const key = taskDateKey(t);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(t);
    }
    return Array.from(m.entries()).sort((a, b) =>
      a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
    );
  }, [tasks]);
  return (
    <div className="q-tasks-list">
      {groups.map(([key, list]) => (
        <div key={key}>
          <div className="q-tasks-group-h">
            {dateHeaderLabel(key)}
            <span className="q-tasks-group-n"> · {list.length}</span>
          </div>
          {list.map((t) => (
            <TaskRow
              key={`${t.leafId}:${t.sourceLine}`}
              task={t}
              author={getUser(t.authorId)}
              dateFormat={dateFormat}
              exists={exists}
              onToggle={() => onToggle(t)}
              onWikilink={onWikilink}
              onTag={onTag}
              onOpenSource={() => onOpenLeaf(t.leafId)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
