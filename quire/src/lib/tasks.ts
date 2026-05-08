import type { Leaf } from '../types';
import { compareDates, dueStatus, isValidISODate } from './utils';

export const DUE_DATE_RX = /@(\d{4}-\d{2}-\d{2})\b/;
const TASK_LINE_RX = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/;
const FENCE_RX = /^```/;

export interface TaskInfo {
  leafId: string;
  leafTitle: string;
  sourceLine: number;
  done: boolean;
  text: string;
  dueDate: string | null;
  authorId: string;
  leafCreated: string;
  leafEdited: string;
}

/**
 * Toggle the task checkbox on a specific line of a leaf body.
 * Returns the new body, or null if the line isn't a task line.
 */
export function toggleTaskOnLine(body: string, lineNum: number): string | null {
  const lines = body.split('\n');
  if (lineNum < 0 || lineNum >= lines.length) return null;
  const line = lines[lineNum];
  const match = line.match(/^(\s*[-*]\s+\[)([ xX])(\].*)$/);
  if (!match) return null;
  const [, prefix, mark, rest] = match;
  const flipped = mark === ' ' ? 'x' : ' ';
  lines[lineNum] = prefix + flipped + rest;
  return lines.join('\n');
}

/** Extract every task in a leaf as a TaskInfo. Skips fenced code blocks. */
export function extractTasks(leaf: Leaf): TaskInfo[] {
  const tasks: TaskInfo[] = [];
  const lines = leaf.body.split('\n');
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE_RX.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(TASK_LINE_RX);
    if (!m) continue;
    const done = m[1].toLowerCase() === 'x';
    let text = m[2];
    let dueDate: string | null = null;
    const dm = text.match(DUE_DATE_RX);
    if (dm) {
      dueDate = dm[1];
      text = text.replace(DUE_DATE_RX, '').replace(/\s+/g, ' ').trim();
    }
    tasks.push({
      leafId: leaf.id,
      leafTitle: leaf.title,
      sourceLine: i,
      done,
      text,
      dueDate,
      authorId: leaf.authorId,
      leafCreated: leaf.created,
      leafEdited: leaf.edited,
    });
  }
  return tasks;
}

export type TaskSort = 'due' | 'created' | 'leaf';

const FAR_FUTURE = '9999-99-99';

export function sortTasks(tasks: TaskInfo[], sort: TaskSort): TaskInfo[] {
  const out = [...tasks];
  if (sort === 'due') {
    out.sort((a, b) => {
      // done last
      if (a.done !== b.done) return a.done ? 1 : -1;
      const ad = a.dueDate || FAR_FUTURE;
      const bd = b.dueDate || FAR_FUTURE;
      const cmp = compareDates(ad, bd);
      if (cmp !== 0) return cmp;
      // tiebreak: leaf title then source line
      if (a.leafTitle !== b.leafTitle) return a.leafTitle.localeCompare(b.leafTitle);
      return a.sourceLine - b.sourceLine;
    });
  } else if (sort === 'created') {
    out.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      // newest leaf first
      const c = compareDates(b.leafCreated || '', a.leafCreated || '');
      if (c !== 0) return c;
      return a.sourceLine - b.sourceLine;
    });
  } else {
    out.sort((a, b) => {
      if (a.leafTitle !== b.leafTitle) return a.leafTitle.localeCompare(b.leafTitle);
      return a.sourceLine - b.sourceLine;
    });
  }
  return out;
}

export interface TaskCounts {
  total: number;
  open: number;
  done: number;
  overdue: number;
  dueToday: number;
  upcoming: number;
}

export function computeCounts(tasks: TaskInfo[]): TaskCounts {
  let open = 0;
  let done = 0;
  let overdue = 0;
  let dueToday = 0;
  let upcoming = 0;
  for (const t of tasks) {
    if (t.done) {
      done++;
    } else {
      open++;
      if (t.dueDate && isValidISODate(t.dueDate)) {
        const status = dueStatus(t.dueDate, false);
        if (status === 'overdue') overdue++;
        else if (status === 'today') dueToday++;
        else if (status === 'upcoming') upcoming++;
      }
    }
  }
  return { total: tasks.length, open, done, overdue, dueToday, upcoming };
}

/** All tasks across leaves, useful for the Tasks view + sidebar summary. */
export function allTasks(leaves: Leaf[]): TaskInfo[] {
  const out: TaskInfo[] = [];
  for (const l of leaves) {
    for (const t of extractTasks(l)) out.push(t);
  }
  return out;
}
