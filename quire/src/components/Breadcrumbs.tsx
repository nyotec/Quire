import type { Folder, FolderID } from '../types';
import { folderPath } from '../lib/folders';

interface Props {
  folders: Folder[];
  folderId: FolderID | null | undefined;
  onClickSegment: (id: FolderID) => void;
  /** Maximum visible segments before collapsing with ellipsis. */
  max?: number;
}

export function Breadcrumbs({ folders, folderId, onClickSegment, max = 3 }: Props) {
  if (!folderId) return null;
  const path = folderPath(folders, folderId);
  if (path.length === 0) return null;
  let segments = path;
  let collapsed = false;
  if (path.length > max) {
    segments = [path[0], path[path.length - 1]];
    collapsed = true;
  }
  return (
    <div className="q-breadcrumbs" aria-label="Folder path">
      <span className="q-breadcrumbs-glyph">📁</span>
      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1;
        return (
          <span key={seg.id} className="q-breadcrumb-seg">
            {collapsed && idx === 1 && (
              <span className="q-breadcrumb-ellipsis"> › … ›</span>
            )}
            <button
              className="q-breadcrumb-btn"
              onClick={(e) => {
                e.stopPropagation();
                onClickSegment(seg.id);
              }}
            >
              {seg.name}
            </button>
            {!isLast && <span className="q-breadcrumb-sep"> › </span>}
          </span>
        );
      })}
    </div>
  );
}
