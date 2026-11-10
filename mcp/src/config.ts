/**
 * Configuration loading for the Quire MCP server.
 *
 * Config lives at `~/.config/quire-mcp/config.json` (or `$XDG_CONFIG_HOME`,
 * or an explicit `$QUIRE_MCP_CONFIG` path). It maps friendly names to Quire
 * files, describes the capturing agent's identity, and gates file creation.
 */
import { homedir } from 'node:os';
import { join, isAbsolute, resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

export interface FileEntry {
  /** Absolute path to the Quire .html file. `~` is expanded. */
  path: string;
  /** Human-readable description to help the agent route notes. */
  description?: string;
  /** When true, this file is used when a tool is called without a `file`. */
  default?: boolean;
}

export interface AgentIdentity {
  /** Display name for the agent's User record, e.g. "Claude". */
  name: string;
  /** Emoji/character shown in place of initials on the chip. Defaults to 🤖. */
  icon?: string;
  /** Chip color (any CSS color). Defaults to a violet. */
  color?: string;
}

export interface QuireMcpConfig {
  files: Record<string, FileEntry>;
  allowFileCreation: boolean;
  /** Directory new files may be created under (required for create_file). */
  fileCreationBaseDir?: string;
  agentIdentity: AgentIdentity;
  /**
   * v1.7: when true (the only supported value for now), the server refuses to
   * read or write any wiki that carries encryption (master password, folder
   * protection, or encrypted leaf bodies).
   */
  refuseEncrypted: boolean;
}

export class ConfigError extends Error {
  code = 'CONFIG_ERROR';
}

function expandHome(p: string): string {
  if (p === '~') return homedir();
  if (p.startsWith('~/')) return join(homedir(), p.slice(2));
  return p;
}

export function configPath(): string {
  if (process.env.QUIRE_MCP_CONFIG) {
    return resolve(expandHome(process.env.QUIRE_MCP_CONFIG));
  }
  const base =
    process.env.XDG_CONFIG_HOME && process.env.XDG_CONFIG_HOME.trim()
      ? process.env.XDG_CONFIG_HOME
      : join(homedir(), '.config');
  return join(base, 'quire-mcp', 'config.json');
}

const DEFAULT_AGENT: AgentIdentity = {
  name: 'Claude',
  icon: '🤖',
  color: '#7c3aed',
};

export function loadConfig(): QuireMcpConfig {
  const path = configPath();
  if (!existsSync(path)) {
    throw new ConfigError(
      `No config found at ${path}. Create one (see example-config.json) ` +
        `mapping names to your Quire .html files.`,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    throw new ConfigError(`Config at ${path} is not valid JSON: ${String(err)}`);
  }

  if (!raw || typeof raw !== 'object') {
    throw new ConfigError(`Config at ${path} must be a JSON object.`);
  }
  const obj = raw as Record<string, unknown>;

  const filesIn = obj.files;
  if (!filesIn || typeof filesIn !== 'object') {
    throw new ConfigError(
      `Config "files" must be an object mapping names to { path, description? }.`,
    );
  }

  const files: Record<string, FileEntry> = {};
  let defaultCount = 0;
  for (const [name, entry] of Object.entries(filesIn as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') {
      throw new ConfigError(`Config file entry "${name}" must be an object.`);
    }
    const e = entry as Record<string, unknown>;
    if (typeof e.path !== 'string' || !e.path.trim()) {
      throw new ConfigError(`Config file entry "${name}" needs a "path" string.`);
    }
    const abs = resolve(expandHome(e.path));
    if (!isAbsolute(abs)) {
      throw new ConfigError(`Config file entry "${name}" path must resolve absolute.`);
    }
    const isDefault = e.default === true;
    if (isDefault) defaultCount++;
    files[name] = {
      path: abs,
      description: typeof e.description === 'string' ? e.description : undefined,
      default: isDefault,
    };
  }

  if (Object.keys(files).length === 0) {
    throw new ConfigError(`Config "files" is empty — add at least one Quire file.`);
  }
  if (defaultCount > 1) {
    throw new ConfigError(`Only one file may be marked "default": true.`);
  }

  const agentIn = (obj.agentIdentity as Record<string, unknown>) || {};
  const agentIdentity: AgentIdentity = {
    name:
      typeof agentIn.name === 'string' && agentIn.name.trim()
        ? agentIn.name.trim()
        : DEFAULT_AGENT.name,
    icon:
      typeof agentIn.icon === 'string' && agentIn.icon.trim()
        ? agentIn.icon.trim()
        : DEFAULT_AGENT.icon,
    color:
      typeof agentIn.color === 'string' && agentIn.color.trim()
        ? agentIn.color.trim()
        : DEFAULT_AGENT.color,
  };

  const fileCreationBaseDir =
    typeof obj.fileCreationBaseDir === 'string' && obj.fileCreationBaseDir.trim()
      ? resolve(expandHome(obj.fileCreationBaseDir))
      : undefined;

  return {
    files,
    allowFileCreation: obj.allowFileCreation === true,
    fileCreationBaseDir,
    agentIdentity,
    // v1.7 always refuses encrypted wikis; honour an explicit false only if a
    // future build flips the default, but default to true when unset.
    refuseEncrypted: obj.refuseEncrypted !== false,
  };
}

/** Resolve a file name (or undefined → the default) to its entry. */
export function resolveFile(
  config: QuireMcpConfig,
  name?: string,
): { name: string; entry: FileEntry } {
  if (name) {
    const entry = config.files[name];
    if (!entry) {
      const known = Object.keys(config.files).join(', ') || '(none)';
      throw new ConfigError(`Unknown file "${name}". Configured files: ${known}.`);
    }
    return { name, entry };
  }
  const defaultName = Object.keys(config.files).find(
    (n) => config.files[n].default,
  );
  if (defaultName) return { name: defaultName, entry: config.files[defaultName] };
  const names = Object.keys(config.files);
  if (names.length === 1) return { name: names[0], entry: config.files[names[0]] };
  throw new ConfigError(
    `No file specified and no default configured. Pass "file" (one of: ${names.join(', ')}).`,
  );
}
