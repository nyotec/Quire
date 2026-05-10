import { useEffect } from 'react';

interface TitleArgs {
  locked: boolean;
  hideIdentifyingInfo: boolean;
  lockTitle?: string | null;
  filename?: string | null;
}

export function computeDocumentTitle({
  locked,
  hideIdentifyingInfo,
  lockTitle,
  filename,
}: TitleArgs): string {
  if (locked) {
    if (hideIdentifyingInfo) return '🔒 Locked';
    const ident = (lockTitle && lockTitle.trim()) || filename || 'Quire';
    return `🔒 ${ident}`;
  }
  const ident = (lockTitle && lockTitle.trim()) || filename;
  return ident ? `${ident} — Quire` : 'Quire';
}

export function useDocumentTitle(args: TitleArgs) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = computeDocumentTitle(args);
  }, [args.locked, args.hideIdentifyingInfo, args.lockTitle, args.filename]);
}
