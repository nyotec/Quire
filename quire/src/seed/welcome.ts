import type { Leaf } from '../types';

export function welcomeLeaf(): Leaf {
  const now = new Date().toISOString();
  return {
    id: 'welcome',
    title: 'Welcome to Quire',
    tags: ['meta', 'guide'],
    pinned: true,
    created: now,
    edited: now,
    body: `Quire is a **single-file notebook**. Open this very page, and everything you'll ever write lives inside it. No server, no database — just one HTML file that travels with you.

Every note is called a *leaf*. Leaves can be linked together with [[Wikilinks]], grouped with tags like #zettel, and arranged into a stream you can read like a river.

Try it:
- Press \`⌘K\` to fly through everything by name.
- Press \`⌘N\` to start a new leaf.
- Press \`⌘S\` to save your wiki to disk.

In Chromium browsers (Chrome, Edge, Brave, Arc), you'll be prompted once to connect Quire to a file on disk. After that, every change auto-saves silently.

In Firefox and Safari, hit \`⌘S\` to download the updated HTML — replace your old quire.html with it to keep changes permanent.`,
  };
}
