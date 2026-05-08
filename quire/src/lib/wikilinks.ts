import type { Leaf, LeafID, BacklinkRef } from '../types';
import { extractWikilinks } from './utils';

export interface WikiIndex {
  byId: Map<LeafID, Leaf>;
  byTitle: Map<string, Leaf>;
  forward: Map<LeafID, LeafID[]>;
  back: Map<LeafID, BacklinkRef[]>;
}

export function buildIndex(leaves: Leaf[]): WikiIndex {
  const byId = new Map<LeafID, Leaf>();
  const byTitle = new Map<string, Leaf>();
  for (const l of leaves) {
    byId.set(l.id, l);
    byTitle.set(l.title.toLowerCase(), l);
  }
  const forward = new Map<LeafID, LeafID[]>();
  const back = new Map<LeafID, BacklinkRef[]>();
  for (const l of leaves) {
    const ts = extractWikilinks(l.body);
    forward.set(l.id, []);
    for (const t of ts) {
      const tgt = byTitle.get(t.toLowerCase());
      if (tgt) {
        forward.get(l.id)!.push(tgt.id);
        if (!back.has(tgt.id)) back.set(tgt.id, []);
        const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rx = new RegExp('([^.\n]*\\[\\[' + escaped + '\\]\\][^.\n]*)', 'i');
        const m = l.body.match(rx);
        const snippet = (m ? m[1] : '').trim().replace(/\s+/g, ' ').slice(0, 120);
        back.get(tgt.id)!.push({ id: l.id, title: l.title, snippet });
      }
    }
  }
  return { byId, byTitle, forward, back };
}

export function tagCounts(leaves: Leaf[]): [string, number][] {
  const m = new Map<string, number>();
  for (const l of leaves) for (const t of l.tags) m.set(t, (m.get(t) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
