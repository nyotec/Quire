import { useMemo, DragEvent } from 'react';
import type { Leaf, BacklinkRef } from '../types';
import { Icon } from './Icon';
import { formatRel } from '../lib/utils';
import { renderMarkdown } from '../lib/markdown';

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
  onChange: (next: Leaf) => void;
  onToggleEdit: () => void;
  onTogglePin: () => void;
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
  onChange,
  onToggleEdit,
  onTogglePin,
  dragHandlers,
}: LeafCardProps) {
  const ctx = useMemo(
    () => ({ exists, onWikilink, onTag }),
    [exists, onWikilink, onTag],
  );

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
            value={leaf.body}
            onChange={(e) => onChange({ ...leaf, body: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            spellCheck={false}
          />
        ) : (
          <div className="q-md">{renderMarkdown(leaf.body, ctx)}</div>
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
            {backlinks.map((b) => (
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
              </button>
            ))}
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
