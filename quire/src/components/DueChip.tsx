import { dueStatus, formatDue, isValidISODate, DateFormat } from '../lib/utils';

interface Props {
  date: string;
  done: boolean;
  format?: DateFormat;
}

export function DueChip({ date, done, format = 'relative' }: Props) {
  if (!isValidISODate(date)) {
    return (
      <span className="q-due" title={`Invalid date: ${date}`}>
        @{date}
      </span>
    );
  }
  const status = dueStatus(date, done);
  const cls =
    'q-due ' +
    (status === 'overdue'
      ? 'q-due-overdue'
      : status === 'today'
        ? 'q-due-today'
        : status === 'done'
          ? 'q-due-done'
          : 'q-due-upcoming');
  return (
    <span className={cls} title={date}>
      {formatDue(date, format)}
    </span>
  );
}
