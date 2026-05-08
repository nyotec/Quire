import type { DateFormat, User } from '../types';
import type { TaskInfo } from '../lib/tasks';
import { renderInline } from '../lib/markdown';
import { AuthorChip } from './AuthorChip';
import { DueChip } from './DueChip';
import { Icon } from './Icon';

interface Props {
  task: TaskInfo;
  author: User | null;
  dateFormat: DateFormat;
  exists: (title: string) => boolean;
  onToggle: () => void;
  onWikilink: (target: string) => void;
  onTag: (tag: string) => void;
  onOpenSource: () => void;
}

export function TaskRow({
  task,
  author,
  dateFormat,
  exists,
  onToggle,
  onWikilink,
  onTag,
  onOpenSource,
}: Props) {
  const ctx = {
    exists,
    onWikilink,
    onTag,
    dateFormat,
  };
  return (
    <div className="q-tasks-row">
      <button
        type="button"
        className={'q-checkbox q-checkbox-btn' + (task.done ? ' q-checkbox-on' : '')}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? 'Mark task incomplete' : 'Mark task complete'}
      >
        {task.done ? '✓' : ''}
      </button>
      <div className={'q-tasks-row-text' + (task.done ? ' done' : '')}>
        {renderInline(task.text, ctx, { isTaskText: false })}
      </div>
      <div className="q-tasks-row-meta">
        {task.dueDate && (
          <DueChip date={task.dueDate} done={task.done} format={dateFormat} />
        )}
        <button
          type="button"
          className="q-tasks-row-leaf"
          onClick={(e) => {
            e.stopPropagation();
            onOpenSource();
          }}
          title={`Open ${task.leafTitle}`}
        >
          <Icon name="arrow" size={11} />
          <span>{task.leafTitle}</span>
        </button>
        {author && <AuthorChip user={author} />}
      </div>
    </div>
  );
}
