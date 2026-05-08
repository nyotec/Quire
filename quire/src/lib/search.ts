import Fuse from 'fuse.js';
import type { Leaf } from '../types';

export function makeFuse(leaves: Leaf[]): Fuse<Leaf> {
  return new Fuse(leaves, {
    keys: [
      { name: 'title', weight: 0.8 },
      { name: 'tags', weight: 0.15 },
      { name: 'body', weight: 0.05 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
    includeScore: true,
  });
}
