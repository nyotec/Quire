import type { User } from '../types';

interface Props {
  user: User | null;
  size?: 'sm' | 'md';
  title?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function AuthorChip({ user, size = 'sm', title, onClick }: Props) {
  const u = user || {
    id: 'unknown',
    name: 'Unknown user',
    initials: '?',
    color: 'oklch(0.65 0.02 60)',
    joined: '',
    lastSeen: '',
  };
  const style: React.CSSProperties = {
    background: `color-mix(in oklch, ${u.color} 18%, transparent)`,
    borderColor: `color-mix(in oklch, ${u.color} 35%, transparent)`,
    color: `color-mix(in oklch, ${u.color} 90%, black)`,
  };
  return (
    <span
      className={'q-author-chip' + (size === 'md' ? ' q-author-chip-md' : '')}
      style={style}
      title={title || `${u.name}`}
      onClick={onClick}
    >
      {u.initials}
    </span>
  );
}

export function AuthorChipPair({
  author,
  editor,
  authorTitle,
  editorTitle,
  onClickAuthor,
  onClickEditor,
}: {
  author: User | null;
  editor: User | null;
  authorTitle?: string;
  editorTitle?: string;
  onClickAuthor?: (e: React.MouseEvent) => void;
  onClickEditor?: (e: React.MouseEvent) => void;
}) {
  const same = author && editor && author.id === editor.id;
  if (same) {
    return <AuthorChip user={author} title={authorTitle} onClick={onClickAuthor} />;
  }
  return (
    <span className="q-author-chip-pair">
      <AuthorChip user={author} title={authorTitle} onClick={onClickAuthor} />
      <span className="q-author-chip-arrow" aria-hidden="true">
        →
      </span>
      <AuthorChip user={editor} title={editorTitle} onClick={onClickEditor} />
    </span>
  );
}
