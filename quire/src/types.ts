export type LeafID = string;
export type UserID = string;

export interface User {
  id: UserID;
  name: string;
  initials: string;
  color: string;
  joined: string;
  lastSeen: string;
}

export interface Leaf {
  id: LeafID;
  title: string;
  body: string;
  tags: string[];
  pinned?: boolean;
  isJournal?: boolean;
  created: string;
  edited: string;
  authorId: UserID;
  lastEditedBy: UserID;
  contributors: UserID[];
}

export type ThemeName = 'paper' | 'ink' | 'mono';
export type AccentName = 'ochre' | 'sage' | 'indigo' | 'rust' | 'plum';
export type FontPair = 'editorial' | 'modern' | 'classic' | 'terminal';
export type Density = 'compact' | 'regular' | 'comfy';
export type LayoutName = 'river' | 'stack';
export type DateFormat = 'relative' | 'absolute' | 'both';

export interface TaskSettings {
  showOverdueBadge: boolean;
  dateFormat: DateFormat;
}

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
  tasks: TaskSettings;
}

export interface WikiState {
  schemaVersion: 2;
  wikiId: string;
  leaves: Leaf[];
  openIds: LeafID[];
  focusedId: LeafID | null;
  settings: Settings;
  lastSaved: string;
  users: User[];
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
  authorId?: UserID;
}

export type ActiveFilter =
  | { type: 'tag'; value: string }
  | { type: 'author'; value: UserID }
  | null;

export const LEGACY_USER_ID: UserID = 'legacy';

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
  tasks: {
    showOverdueBadge: true,
    dateFormat: 'relative',
  },
};
