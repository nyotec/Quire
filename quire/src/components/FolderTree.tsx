import { useMemo, useState } from 'react';
import type { ActiveFilter, Folder, FolderID, Leaf } from '../types';
import { Icon } from './Icon';
import { buildFolderTree, FolderTreeNode, leavesInFolder } from '../lib/folders';
import { isFolderUnlocked } from '../lib/lockState';

interface Props {
  folders: Folder[];
  leaves: Leaf[];
  activeFilter: ActiveFilter;
  onFilterFolder: (id: FolderID | null, deep: boolean) => void;
  onCreateFolder: (parentId: FolderID | null) => void;
  onContextMenu: (folder: Folder, evt: { x: number; y: number }) => void;
  showLeafCounts: boolean;
}

export function FolderTree({
  folders,
  leaves,
  activeFilter,
  onFilterFolder,
  onCreateFolder,
  onContextMenu,
  showLeafCounts,
}: Props) {
  const [expanded, setExpanded] = useState<Set<FolderID>>(() => new Set());

  const tree = useMemo(() => buildFolderTree(folders), [folders]);
  const activeFolderId =
    activeFilter?.type === 'folder' ? activeFilter.value : null;
  const rootCount = leaves.filter((l) => !l.folderId).length;

  const toggle = (id: FolderID) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="q-folder-tree">
      <button
        className={
          'q-folder-row' + (activeFolderId === null ? ' active' : '')
        }
        onClick={() => onFilterFolder(null, true)}
        title="All notes"
      >
        <span className="q-folder-caret" />
        <span className="q-folder-glyph">📁</span>
        <span className="q-folder-name">All notes</span>
        {showLeafCounts && (
          <span className="q-folder-count">{leaves.length}</span>
        )}
        <button
          className="q-folder-row-add"
          onClick={(e) => {
            e.stopPropagation();
            onCreateFolder(null);
          }}
          title="New folder"
          aria-label="New folder"
        >
          <Icon name="plus" size={11} />
        </button>
      </button>
      <div className="q-folder-children">
        {tree.map((node) => (
          <FolderTreeNodeView
            key={node.folder.id}
            node={node}
            leaves={leaves}
            folders={folders}
            expanded={expanded}
            toggle={toggle}
            activeFolderId={activeFolderId}
            onFilterFolder={onFilterFolder}
            onCreateFolder={onCreateFolder}
            onContextMenu={onContextMenu}
            showLeafCounts={showLeafCounts}
          />
        ))}
      </div>
      {tree.length === 0 && rootCount === 0 && (
        <div className="q-folder-empty">
          <em>No folders yet.</em>
        </div>
      )}
    </div>
  );
}

function FolderTreeNodeView({
  node,
  leaves,
  folders,
  expanded,
  toggle,
  activeFolderId,
  onFilterFolder,
  onCreateFolder,
  onContextMenu,
  showLeafCounts,
}: {
  node: FolderTreeNode;
  leaves: Leaf[];
  folders: Folder[];
  expanded: Set<FolderID>;
  toggle: (id: FolderID) => void;
  activeFolderId: FolderID | null;
  onFilterFolder: (id: FolderID | null, deep: boolean) => void;
  onCreateFolder: (parentId: FolderID | null) => void;
  onContextMenu: (folder: Folder, evt: { x: number; y: number }) => void;
  showLeafCounts: boolean;
}) {
  const f = node.folder;
  const isExpanded = expanded.has(f.id);
  const isActive = activeFolderId === f.id;
  const isLocked = !!f.protection && !isFolderUnlocked(f.id);
  const hideName = isLocked && !!f.protection?.hideName;
  const hideContents = isLocked && !!f.protection?.hideContents;
  const count = useMemo(
    () => leavesInFolder(leaves, folders, f.id, true).length,
    [leaves, folders, f.id],
  );
  const displayName = hideName ? 'Locked' : f.name;
  const glyph = isLocked ? '🔒' : f.icon || '📁';

  return (
    <>
      <button
        className={
          'q-folder-row' +
          (isActive ? ' active' : '') +
          (isLocked ? ' locked' : '')
        }
        style={{ paddingLeft: 10 + node.depth * 16 }}
        onClick={() => onFilterFolder(f.id, true)}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(f, { x: e.clientX, y: e.clientY });
        }}
        title={f.name}
      >
        {node.children.length > 0 ? (
          <span
            className="q-folder-caret"
            onClick={(e) => {
              e.stopPropagation();
              toggle(f.id);
            }}
            role="button"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▾' : '▸'}
          </span>
        ) : (
          <span className="q-folder-caret" />
        )}
        <span
          className="q-folder-glyph"
          style={f.color ? { color: f.color } : undefined}
        >
          {glyph}
        </span>
        <span className="q-folder-name">{displayName}</span>
        {showLeafCounts && !hideContents && (
          <span className="q-folder-count">{count}</span>
        )}
        <button
          className="q-folder-row-more"
          onClick={(e) => {
            e.stopPropagation();
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onContextMenu(f, { x: r.left, y: r.bottom + 4 });
          }}
          title="Folder options"
          aria-label="Folder options"
        >
          <Icon name="more" size={12} />
        </button>
      </button>
      {isExpanded && node.children.length > 0 && (
        <div className="q-folder-children">
          {node.children.map((c) => (
            <FolderTreeNodeView
              key={c.folder.id}
              node={c}
              leaves={leaves}
              folders={folders}
              expanded={expanded}
              toggle={toggle}
              activeFolderId={activeFolderId}
              onFilterFolder={onFilterFolder}
              onCreateFolder={onCreateFolder}
              onContextMenu={onContextMenu}
              showLeafCounts={showLeafCounts}
            />
          ))}
        </div>
      )}
    </>
  );
}
