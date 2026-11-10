export type LeafID = string;
export type UserID = string;

export interface User {
  id: UserID;
  name: string;
  initials: string;
  color: string;
  joined: string;
  lastSeen: string;
  /** v1.7: true when this User represents an AI agent (MCP capture). */
  isAgent?: boolean;
}

/**
 * v1.7: optional source attribution for a leaf. Populated when an MCP agent
 * captures a note derived from an external source (Jira, Gmail, web, …).
 * Absent on leaves created in the Quire UI.
 */
export interface LeafSource {
  type: string; // free-form, e.g. "jira", "gmail", "slack", "web", "manual", "digest"
  id?: string; // source-specific identifier, e.g. "WMBT-1234"
  url?: string; // clickable link back to the source
  title?: string; // the source's own title, e.g. the email subject
  capturedAt: string; // ISO timestamp when the note was captured
  capturedBy?: string; // free-form identifier for the capturing agent, e.g. "claude-desktop"
}

export interface EncryptedField {
  v: 1;
  iv: string; // base64
  ct: string; // base64
}

export type LeafBody = string | EncryptedField;

export interface FolderProtection {
  salt: string;
  iterations: number;
  hash: 'SHA-256';
  verifier: EncryptedField;
  hideContents: boolean; // suppress leaf count when locked
  hideName: boolean; // replace folder name with "Locked" when locked
}

export type FolderID = string;

export interface Folder {
  id: FolderID;
  name: string;
  parentId: FolderID | null;
  color?: string;
  icon?: string; // single emoji or character
  created: string;
  protection?: FolderProtection;
}

export const FOLDER_VERIFIER_PLAINTEXT = 'quire-folder-v1-verifier';

export interface Leaf {
  id: LeafID;
  title: string;
  body: LeafBody;
  tags: string[];
  pinned?: boolean;
  isJournal?: boolean;
  created: string;
  edited: string;
  authorId: UserID;
  lastEditedBy: UserID;
  contributors: UserID[];
  folderId?: FolderID | null;
  /** v1.7: source attribution for agent-captured leaves. Undefined on UI-created leaves. */
  source?: LeafSource;
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
  /** Opt-in author chips (v1.6.1). Defaults to false for solo users. */
  showAuthorAttribution: boolean;
}

export type ProtectionMode = 'curtain' | 'password';

export interface ProtectionConfig {
  mode: ProtectionMode;
  // Only present when mode === 'password':
  salt?: string;
  iterations?: number;
  hash?: 'SHA-256';
  verifier?: EncryptedField;
  // Lock screen identification (always plaintext, visible while locked):
  lockTitle?: string;
  lockSubtitle?: string;
  hideIdentifyingInfo?: boolean;
}

export interface AutolockConfig {
  inactivityTimeoutMs: number; // 0 = off
  hiddenTimeoutMs: number; // 0 = off
}

export interface WikiState {
  schemaVersion: 5;
  wikiId: string;
  leaves: Leaf[];
  openIds: LeafID[];
  focusedId: LeafID | null;
  settings: Settings;
  lastSaved: string;
  users: User[];
  protection: ProtectionConfig;
  autolock: AutolockConfig;
  folders: Folder[];
}

export const DEFAULT_AUTOLOCK: AutolockConfig = {
  inactivityTimeoutMs: 5 * 60 * 1000,
  hiddenTimeoutMs: 30 * 1000,
};

export const DEFAULT_PROTECTION: ProtectionConfig = {
  mode: 'curtain',
  hideIdentifyingInfo: false,
};

export const VERIFIER_PLAINTEXT = 'quire-v1-verifier';

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
  | { type: 'all' }
  | { type: 'tag'; value: string }
  | { type: 'author'; value: UserID }
  | { type: 'folder'; value: FolderID; deep: boolean }
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
  showAuthorAttribution: false,
};
