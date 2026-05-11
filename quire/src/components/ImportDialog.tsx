import { useEffect, useRef, useState } from 'react';
import type { WikiState } from '../types';
import { useShortcuts } from '../lib/hotkeys';
import { parseImportJSON, readJSONFile } from '../lib/importParser';
import {
  ConflictReport,
  detectConflicts,
  FolderConflict,
  LeafConflict,
  TitleConflict,
} from '../lib/conflictDetector';
import { bulkSetResolution, mergeImport, MergeOutcome } from '../lib/merger';

interface Props {
  open: boolean;
  currentState: WikiState;
  initialFile?: File | null;
  onCancel: () => void;
  onApply: (merged: WikiState, alsoBackupCurrent: boolean) => void;
}

type Step =
  | { kind: 'pick' }
  | { kind: 'reading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'review';
      imported: WikiState;
      report: ConflictReport;
      warnings: string[];
      sourceVersion: number;
    }
  | {
      kind: 'preview';
      imported: WikiState;
      report: ConflictReport;
      warnings: string[];
      sourceVersion: number;
      outcome: MergeOutcome;
    };

export function ImportDialog({
  open,
  currentState,
  initialFile,
  onCancel,
  onApply,
}: Props) {
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [alsoBackup, setAlsoBackup] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useShortcuts((action) => {
    if (!open) return false;
    if (action === 'esc') {
      onCancel();
      return true;
    }
    return false;
  });

  // Reset on open / handle preselected file
  useEffect(() => {
    if (!open) return;
    if (initialFile) {
      void handleFile(initialFile);
    } else {
      setStep({ kind: 'pick' });
    }
    setAlsoBackup(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFile]);

  const handleFile = async (file: File) => {
    setStep({ kind: 'reading' });
    try {
      const text = await readJSONFile(file);
      const parsed = parseImportJSON(text);
      const report = detectConflicts(currentState, parsed.state);
      setStep({
        kind: 'review',
        imported: parsed.state,
        report,
        warnings: parsed.warnings,
        sourceVersion: parsed.sourceVersion,
      });
    } catch (err: any) {
      setStep({ kind: 'error', message: err?.message || 'Failed to read file.' });
    }
  };

  const onPickClick = () => fileInputRef.current?.click();

  const updateConflict = (idx: number, resolution: any) => {
    if (step.kind !== 'review') return;
    const next = step.report.conflicts.map((c, i) =>
      i === idx ? ({ ...c, resolution } as any) : c,
    );
    setStep({ ...step, report: { ...step.report, conflicts: next } });
  };

  const advanceToPreview = () => {
    if (step.kind !== 'review') return;
    const outcome = mergeImport(currentState, step.imported, step.report);
    setStep({
      kind: 'preview',
      imported: step.imported,
      report: step.report,
      warnings: step.warnings,
      sourceVersion: step.sourceVersion,
      outcome,
    });
  };

  const applyImport = () => {
    if (step.kind !== 'preview') return;
    onApply(step.outcome.state, alsoBackup);
  };

  if (!open) return null;

  return (
    <div className="q-modal-scrim">
      <div
        className="q-modal q-import-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {step.kind === 'pick' && (
          <>
            <div className="q-modal-title">Import JSON file</div>
            <div className="q-modal-body">
              <p style={{ margin: '0 0 12px' }}>
                Select a Quire JSON export to import content from.
              </p>
              <div
                className="q-import-dropzone"
                role="button"
                tabIndex={0}
                onClick={onPickClick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onPickClick();
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const files = Array.from(e.dataTransfer.files);
                  if (files.length !== 1) return;
                  void handleFile(files[0]);
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 8 }}>📥</div>
                <div style={{ fontSize: 14, marginBottom: 4 }}>
                  Drop a .json file here
                </div>
                <div className="q-drawer-info">or click to browse</div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
              <div className="q-drawer-info" style={{ marginTop: 10 }}>
                Your existing notes will not be modified — content is merged
                from the source file into this one.
              </div>
            </div>
            <div className="q-modal-actions">
              <button className="q-onboard-skip" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </>
        )}

        {step.kind === 'reading' && (
          <>
            <div className="q-modal-title">Reading file…</div>
            <div className="q-modal-body">
              Parsing and validating. This usually takes a moment.
            </div>
          </>
        )}

        {step.kind === 'error' && (
          <>
            <div className="q-modal-title q-modal-title-warn">
              Couldn't import this file
            </div>
            <div className="q-modal-body">
              <p>{step.message}</p>
            </div>
            <div className="q-modal-actions">
              <button className="q-onboard-skip" onClick={onCancel}>
                Cancel
              </button>
              <button
                className="q-btn-primary"
                onClick={() => setStep({ kind: 'pick' })}
              >
                Pick a different file
              </button>
            </div>
          </>
        )}

        {step.kind === 'review' && (
          <>
            <div className="q-modal-title">
              {step.report.conflicts.length === 0
                ? 'Ready to import'
                : `Resolve conflicts (${step.report.conflicts.length})`}
            </div>
            <div className="q-modal-body q-import-review-body">
              {step.warnings.length > 0 && (
                <div className="q-import-warnings">
                  <b>Migration warnings:</b>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                    {step.warnings.slice(0, 5).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                    {step.warnings.length > 5 && (
                      <li>… and {step.warnings.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              {step.report.conflicts.length === 0 ? (
                <p>
                  No conflicts. {step.report.freshLeaves.length} leaves,{' '}
                  {step.report.freshFolders.length} folders, and{' '}
                  {step.report.freshUsers.length} users will be added.
                </p>
              ) : (
                <>
                  {step.imported.wikiId === currentState.wikiId && (
                    <BulkResolveBar
                      onApply={(r) =>
                        setStep({
                          ...step,
                          report: bulkSetResolution(step.report, r as any),
                        })
                      }
                    />
                  )}
                  <div className="q-import-conflicts">
                    {step.report.conflicts.map((c, idx) => (
                      <ConflictRow
                        key={idx}
                        conflict={c}
                        onChange={(r) => updateConflict(idx, r)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="q-modal-actions">
              <button
                className="q-onboard-skip"
                onClick={() => setStep({ kind: 'pick' })}
              >
                ← Back
              </button>
              <button className="q-onboard-skip" onClick={onCancel}>
                Cancel
              </button>
              <button className="q-btn-primary" onClick={advanceToPreview}>
                {step.report.conflicts.length === 0
                  ? 'Continue'
                  : 'Apply merge →'}
              </button>
            </div>
          </>
        )}

        {step.kind === 'preview' && (
          <>
            <div className="q-modal-title">Import preview</div>
            <div className="q-modal-body">
              <p>After import, this wiki will have:</p>
              <ul style={{ paddingLeft: 22 }}>
                <li>
                  {step.outcome.state.leaves.length} leaves (was{' '}
                  {currentState.leaves.length}; +{step.outcome.stats.leavesAdded}{' '}
                  added, {step.outcome.stats.leavesReplaced} replaced,{' '}
                  {step.outcome.stats.leavesRenamed} renamed)
                </li>
                <li>
                  {step.outcome.state.folders.length} folders (was{' '}
                  {currentState.folders.length}; +
                  {step.outcome.stats.foldersAdded} added,{' '}
                  {step.outcome.stats.foldersMerged} merged,{' '}
                  {step.outcome.stats.foldersRenamed} renamed)
                </li>
                <li>
                  {step.outcome.state.users.length} users (+
                  {step.outcome.stats.usersAdded} added)
                </li>
                {step.report.conflicts.length > 0 && (
                  <li>{step.report.conflicts.length} conflicts resolved</li>
                )}
              </ul>
              <p
                className="q-drawer-info"
                style={{ marginTop: 8 }}
              >
                This action cannot be undone. The source file is not modified.
              </p>
              <label className="q-pw-toggle-row" style={{ marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={alsoBackup}
                  onChange={(e) => setAlsoBackup(e.target.checked)}
                />{' '}
                <span>
                  Save a backup of this wiki before importing (recommended)
                </span>
              </label>
            </div>
            <div className="q-modal-actions">
              <button
                className="q-onboard-skip"
                onClick={() =>
                  setStep({
                    kind: 'review',
                    imported: step.imported,
                    report: step.report,
                    warnings: step.warnings,
                    sourceVersion: step.sourceVersion,
                  })
                }
              >
                ← Back
              </button>
              <button className="q-onboard-skip" onClick={onCancel}>
                Cancel
              </button>
              <button className="q-btn-primary" onClick={applyImport}>
                Apply import
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BulkResolveBar({ onApply }: { onApply: (resolution: string) => void }) {
  return (
    <div className="q-import-bulk-bar">
      <span>This looks like a restore from the same wiki.</span>{' '}
      <button
        className="q-drawer-btn"
        style={{ width: 'auto' }}
        onClick={() => onApply('keep-theirs')}
      >
        Set all leaves to: Keep theirs
      </button>
    </div>
  );
}

function ConflictRow({
  conflict,
  onChange,
}: {
  conflict: any;
  onChange: (resolution: string) => void;
}) {
  if (conflict.kind === 'leaf-id') {
    const c = conflict as LeafConflict;
    return (
      <div className="q-import-conflict-row">
        <div className="q-import-conflict-title">
          Leaf "{c.theirs.title}" — exists in both
        </div>
        <div className="q-import-conflict-meta">
          Yours: edited {new Date(c.yours.edited).toLocaleDateString()} ·
          Theirs: edited {new Date(c.theirs.edited).toLocaleDateString()}
        </div>
        <div className="q-import-conflict-actions">
          {(['keep-yours', 'keep-theirs', 'keep-both'] as const).map((r) => (
            <label key={r}>
              <input
                type="radio"
                checked={c.resolution === r}
                onChange={() => onChange(r)}
              />
              {r === 'keep-yours'
                ? 'Keep yours'
                : r === 'keep-theirs'
                  ? 'Keep theirs'
                  : 'Keep both (rename)'}
            </label>
          ))}
        </div>
      </div>
    );
  }
  if (conflict.kind === 'folder-name') {
    const c = conflict as FolderConflict;
    return (
      <div className="q-import-conflict-row">
        <div className="q-import-conflict-title">
          Folder "{c.name}" — exists in both
        </div>
        <div className="q-import-conflict-meta">
          Yours: {c.yoursLeafCount} leaves · Theirs: {c.theirsLeafCount} leaves
        </div>
        <div className="q-import-conflict-actions">
          {(['merge', 'rename-theirs'] as const).map((r) => (
            <label key={r}>
              <input
                type="radio"
                checked={c.resolution === r}
                onChange={() => onChange(r)}
              />
              {r === 'merge' ? 'Merge into one' : 'Keep separate (rename theirs)'}
            </label>
          ))}
        </div>
      </div>
    );
  }
  if (conflict.kind === 'title') {
    const c = conflict as TitleConflict;
    return (
      <div className="q-import-conflict-row">
        <div className="q-import-conflict-title">
          Leaf title "{c.theirs.title}" — different IDs
        </div>
        <div className="q-import-conflict-meta">
          Yours: created {new Date(c.yours.created).toLocaleDateString()} ·
          Theirs: created {new Date(c.theirs.created).toLocaleDateString()}
        </div>
        <div className="q-import-conflict-actions">
          {(['rename-theirs', 'rename-yours', 'keep-both-as-is'] as const).map(
            (r) => (
              <label key={r}>
                <input
                  type="radio"
                  checked={c.resolution === r}
                  onChange={() => onChange(r)}
                />
                {r === 'rename-theirs'
                  ? 'Keep yours, rename theirs'
                  : r === 'rename-yours'
                    ? 'Keep theirs, rename yours'
                    : 'Keep both as-is'}
              </label>
            ),
          )}
        </div>
      </div>
    );
  }
  return null;
}
