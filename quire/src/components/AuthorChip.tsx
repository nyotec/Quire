import type { User } from '../types';

interface Props {
  user: User | null;
  size?: 'sm' | 'md';
  title?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function AuthorChip({ user, size = 'sm', title, onClick }: Props) {
  // v1.6.1: when there's no user (attribution disabled, or unknown author),
  // render nothing. The leaf header still reads cleanly with timestamp + tags.
  if (!user) return null;
  const u = user;
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
  // If neither side has a user, render nothing.
  if (!author && !editor) return null;
  const same = author && editor && author.id === editor.id;
  if (same) {
    return <AuthorChip user={author} title={authorTitle} onClick={onClickAuthor} />;
  }
  // If only one side is present, render just that chip.
  if (!author) return <AuthorChip user={editor} title={editorTitle} onClick={onClickEditor} />;
  if (!editor) return <AuthorChip user={author} title={authorTitle} onClick={onClickAuthor} />;
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
