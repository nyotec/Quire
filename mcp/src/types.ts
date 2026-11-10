/**
 * Minimal mirror of the Quire WikiState shape the MCP server needs to read
 * and write. This intentionally tracks `quire/src/types.ts` — only the fields
 * the server touches are modelled; unknown fields are preserved verbatim on
 * write (we spread the parsed object rather than reconstructing it).
 */

export type LeafID = string;
export type UserID = string;
export type FolderID = string;

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

export interface LeafSource {
  type: string;
  id?: string;
  url?: string;
  title?: string;
  capturedAt: string;
  capturedBy?: string;
}

export interface EncryptedField {
  v: 1;
  iv: string;
  ct: string;
}

export type LeafBody = string | EncryptedField;

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
  source?: LeafSource;
}

export interface FolderProtection {
  salt: string;
  iterations: number;
  hash: 'SHA-256';
  verifier: EncryptedField;
  hideContents: boolean;
  hideName: boolean;
}

export interface Folder {
  id: FolderID;
  name: string;
  parentId: FolderID | null;
  color?: string;
  icon?: string;
  created: string;
  protection?: FolderProtection;
}

export interface ProtectionConfig {
  mode: 'curtain' | 'password';
  salt?: string;
  iterations?: number;
  hash?: 'SHA-256';
  verifier?: EncryptedField;
  lockTitle?: string;
  lockSubtitle?: string;
  hideIdentifyingInfo?: boolean;
}

export interface AutolockConfig {
  inactivityTimeoutMs: number;
  hiddenTimeoutMs: number;
}

export interface Settings {
  theme: string;
  accent: string;
  fontPair: string;
  density: string;
  layout: string;
  sidebar: boolean;
  backlinks: boolean;
  spineNumbers: boolean;
  plugins: Record<string, boolean>;
  tasks: { showOverdueBadge: boolean; dateFormat: string };
  showAuthorAttribution: boolean;
}

export interface WikiState {
  schemaVersion: number;
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
  /** Any additional fields present in the file are preserved on write. */
  [key: string]: unknown;
}

/** The schema version this server writes. Mirrors CURRENT_SCHEMA in the app. */
export const CURRENT_SCHEMA = 5;

/** Consistent error envelope returned by every tool on failure. */
export interface ToolError {
  success: false;
  error: string;
  code: string;
}

export interface ToolOk {
  success: true;
  [key: string]: unknown;
}

export type ToolResult = ToolOk | ToolError;
