import { useCallback, useMemo, DragEvent } from 'react';
import type {
  BacklinkRef,
  DateFormat,
  Folder,
  FolderID,
  Leaf,
  User,
  UserID,
} from '../types';
import { Icon } from './Icon';
import { formatRel } from '../lib/utils';
import { renderMarkdown } from '../lib/markdown';
import { toggleTaskOnLine } from '../lib/tasks';
import { AuthorChip, AuthorChipPair } from './AuthorChip';
import { useShortcuts } from '../lib/hotkeys';
import { bodyAsString } from '../lib/lockState';
import { Breadcrumbs } from './Breadcrumbs';
import { isLeafAccessible } from '../lib/folderCrypto';

interface LeafCardProps {
  leaf: Leaf;
  leafIndex: number;
  focused: boolean;
  isJournal?: boolean;
  editing: boolean;
  showBacklinks: boolean;
  spineNumbers: boolean;
  backlinks: BacklinkRef[];
  exists: (title: string) => boolean;
  onFocus: () => void;
  onClose: () => void;
  onWikilink: (title: string) => void;
  onTag: (tag: string) => void;
  onAuthorClick: (id: UserID) => void;
  onChange: (next: Leaf) => void;
  onChangeBody: (id: string, plaintext: string) => void;
  onToggleEdit: () => void;
  onTogglePin: () => void;
  getUser: (id: UserID | null | undefined) => User | null;
  dateFormat?: DateFormat;
  folders?: Folder[];
  onFolderClick?: (id: FolderID) => void;
  dragHandlers: {
    draggable: boolean;
    onDragStart: (e: DragEvent) => void;
    onDragOver: (e: DragEvent) => void;
    onDrop: (e: DragEvent) => void;
    onDragEnd: () => void;
  };
}

export function LeafCard({
  leaf,
  leafIndex,
  focused,
  isJournal,
  editing,
  showBacklinks,
  spineNumbers,
  backlinks,
  exists,
  onFocus,
  onClose,
  onWikilink,
  onTag,
  onAuthorClick,
  onChange,
  onChangeBody,
  onToggleEdit,
  onTogglePin,
  getUser,
  dateFormat,
  folders,
  onFolderClick,
  dragHandlers,
}: LeafCardProps) {
  const accessible = folders ? isLeafAccessible(folders, leaf) : true;
  const bodyText = bodyAsString(leaf);
  const onTaskToggle = useCallback(
    (line: number) => {
      const next = toggleTaskOnLine(bodyText, line);
      if (next !== null) {
        onChangeBody(leaf.id, next);
      }
    },
    [leaf.id, bodyText, onChangeBody],
  );

  // While editing this leaf, capture Esc and ⌘Return to exit edit mode.
  useShortcuts((action) => {
    if (!editing) return false;
    if (action === 'esc' || action === 'leaf.toggleEdit') {
      onToggleEdit();
      // Return focus to the leaf so the editor textarea no longer holds focus.
      const el = document.querySelector(
        `[data-leaf-id="${leaf.id}"]`,
      ) as HTMLElement | null;
      el?.focus();
      return true;
    }
    return false;
  });

  const ctx = useMemo(
    () => ({
      exists,
      onWikilink,
      onTag,
      // Only attach the toggle handler in render mode (textarea owns edit clicks).
      onTaskToggle: editing ? undefined : onTaskToggle,
      dateFormat,
    }),
    [exists, onWikilink, onTag, editing, onTaskToggle, dateFormat],
  );

  const author = getUser(leaf.authorId);
  const editor = getUser(leaf.lastEditedBy);
  const contributorCount = (leaf.contributors || []).length;
  const authorTitle = author
    ? `Created by ${author.name}${leaf.created ? ' on ' + new Date(leaf.created).toLocaleDateString() : ''}`
    : 'Unknown author';
  const editorTitle = editor
    ? `Last edited by ${editor.name}, ${formatRel(leaf.edited)}${
        contributorCount > 1 ? ' · ' + contributorCount + ' contributors' : ''
      }`
    : 'Unknown editor';

  return (
    <article
      className={
        'q-leaf' +
        (focused ? ' focused' : '') +
        (isJournal ? ' journal' : '') +
        (editing ? ' editing' : '')
      }
      onClick={onFocus}
      data-leaf-id={leaf.id}
      data-screen-label={`Leaf · ${leaf.title}`}
    >
      <header className="q-leaf-head">
        <div className="q-leaf-handle" {...dragHandlers}>
          <Icon name="drag" size={12} />
        </div>
        <div className="q-leaf-titlebar">
          {folders && leaf.folderId && onFolderClick && (
            <Breadcrumbs
              folders={folders}
              folderId={leaf.folderId}
              onClickSegment={onFolderClick}
            />
          )}
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
            <AuthorChipPair
              author={author}
              editor={editor}
              authorTitle={authorTitle}
              editorTitle={editorTitle}
              onClickAuthor={(e) => {
                e.stopPropagation();
                if (author) onAuthorClick(author.id);
              }}
              onClickEditor={(e) => {
                e.stopPropagation();
                if (editor) onAuthorClick(editor.id);
              }}
            />
            <span className="q-leaf-meta-sep">·</span>
            <span>{formatRel(leaf.edited)}</span>
            {leaf.tags.length > 0 && <span className="q-leaf-meta-sep">·</span>}
            {leaf.tags.slice(0, 4).map((t) => (
              <button
                key={t}
                className="q-tag-pill q-tag-pill-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onTag(t);
                }}
              >
                #{t}
              </button>
            ))}
          </div>
        </div>
        <div className="q-leaf-actions">
          <button
            className={'q-icon-btn-sm' + (leaf.pinned ? ' on' : '')}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            title="Pin"
          >
            <Icon name="pin" size={12} />
          </button>
          <button
            className={'q-icon-btn-sm' + (editing ? ' on' : '')}
            onClick={(e) => {
              e.stopPropagation();
              onToggleEdit();
            }}
            title="Edit (⌘E)"
          >
            <Icon name={editing ? 'eye' : 'edit'} size={12} />
          </button>
          <button
            className="q-icon-btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Close (⌘W)"
          >
            <Icon name="close" size={12} />
          </button>
        </div>
      </header>

      <div className="q-leaf-body">
        {editing ? (
          <textarea
            className="q-edit"
            value={bodyText}
            onChange={(e) => onChangeBody(leaf.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            spellCheck={false}
          />
        ) : !accessible ? (
          <div className="q-md q-md-locked">
            <p className="q-p" style={{ color: 'var(--q-dim)' }}>
              <Icon name="lock" size={11} /> This leaf is in a locked folder.
              Unlock the folder to read it.
            </p>
          </div>
        ) : (
          <div className="q-md">{renderMarkdown(bodyText, ctx)}</div>
        )}
      </div>

      {focused && showBacklinks && backlinks.length > 0 && !editing && (
        <footer className="q-leaf-foot">
          <div className="q-foot-h">
            <Icon name="link" size={11} />
            <span>
              {backlinks.length} backlink{backlinks.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="q-foot-list">
            {backlinks.map((b) => {
              const blAuthor = getUser(b.authorId);
              return (
                <button
                  key={b.id}
                  className="q-bl-row"
                  onClick={(e) => {
                    e.stopPropagation();
                    onWikilink(b.title);
                  }}
                >
                  <span className="q-bl-arrow">
                    <Icon name="arrow" size={11} />
                  </span>
                  <span className="q-bl-title">{b.title}</span>
                  <span className="q-bl-snip">{b.snippet}</span>
                  {blAuthor && (
                    <AuthorChip
                      user={blAuthor}
                      title={blAuthor.name}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAuthorClick(blAuthor.id);
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </footer>
      )}

      {spineNumbers && (
        <div className="q-leaf-spine">
          <span>{String(leafIndex + 1).padStart(2, '0')}</span>
        </div>
      )}
    </article>
  );
}
