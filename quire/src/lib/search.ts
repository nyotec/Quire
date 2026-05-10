import Fuse from 'fuse.js';
import type { Leaf } from '../types';
import { bodyAsString } from './lockState';

export function makeFuse(leaves: Leaf[]): Fuse<Leaf> {
  return new Fuse(leaves, {
    keys: [
      { name: 'title', weight: 0.8 },
      { name: 'tags', weight: 0.15 },
      // Use a getter so encrypted bodies don't blow up Fuse — and we only
      // index decrypted text where available (cached via lockState).
      { name: 'body', weight: 0.05, getFn: (l) => bodyAsString(l) },
    ],
    threshold: 0.4,
    ignoreLocation: true,
    includeScore: true,
  });
}
