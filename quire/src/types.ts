export type LeafID = string;

export interface Leaf {
  id: LeafID;
  title: string;
  body: string;
  tags: string[];
  pinned?: boolean;
  isJournal?: boolean;
  created: string;
  edited: string;
}

export type ThemeName = 'paper' | 'ink' | 'mono';
export type AccentName = 'ochre' | 'sage' | 'indigo' | 'rust' | 'plum';
export type FontPair = 'editorial' | 'modern' | 'classic' | 'terminal';
export type Density = 'compact' | 'regular' | 'comfy';
export type LayoutName = 'river' | 'stack';

export interface Settings {
  theme: ThemeName;
  accent: AccentName;
  fontPair: FontPair;
  density: Density;
  layout: LayoutName;
  sidebar: boolean;
  backlinks: boolean;
  spineNumbers: boolean;
  plugins: Record<string, boolean>;
}

export interface WikiState {
  schemaVersion: 1;
  wikiId: string;
  leaves: Leaf[];
  openIds: LeafID[];
  focusedId: LeafID | null;
  settings: Settings;
  lastSaved: string;
}

export type Tier = 'A' | 'B' | 'C';

export interface SaveStatus {
  tier: Tier;
  state: 'saved' | 'dirty' | 'saving' | 'error' | 'browser-only';
  lastSaved: string | null;
  pendingChanges: number;
  errorMessage?: string;
}

export interface BacklinkRef {
  id: LeafID;
  title: string;
  snippet: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'paper',
  accent: 'ochre',
  fontPair: 'editorial',
  density: 'regular',
  layout: 'river',
  sidebar: true,
  backlinks: true,
  spineNumbers: true,
  plugins: {
    backlinks: true,
    graph: false,
    math: false,
    code: true,
    wordcount: false,
    darkjournal: false,
  },
};
