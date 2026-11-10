# @quire/mcp-server

An [MCP](https://modelcontextprotocol.io) server that lets an AI agent read
from and append notes to your [Quire](../quire) wikis — the single-file,
local-first notebook. The agent **helps** you capture into your own notebook; it
never replaces the Quire app, and everything it writes is visibly
agent-authored.

## What it does

Quire stores a whole wiki in one `.html` file. This server reads that file's
embedded data block (lz-string UTF-16, exactly as the app encodes it), appends
or searches notes, and writes the file back **atomically** (temp file + rename),
leaving the compiled app shell byte-for-byte intact. The file keeps opening
natively in the browser.

Notes written by the agent are attributed to a `User` record with
`isAgent: true`, so Quire shows an agent chip (🤖) on them — even when author
attribution is otherwise turned off.

## Tools

| Tool | Purpose |
| --- | --- |
| `list_files` | List configured wikis, their descriptions, leaf counts, and whether each is writable. |
| `list_topics` | Folder structure (topics) and top tags of a wiki, to route notes into existing topics. |
| `search_leaves` | Find existing notes by query / tag / folder; returns ranked snippets. |
| `create_leaf` | Append a new note, attributed to the agent, optionally with a folder and source attribution. |
| `create_file` | Create a new empty wiki (off by default; confined to `fileCreationBaseDir`). |

Every tool returns a consistent envelope: `{ "success": true, … }` or
`{ "success": false, "error": "…", "code": "…" }`.

## Encryption

In v1.7 the server **refuses** any wiki that carries encryption — a master
password, an encrypted folder, or encrypted leaf bodies. Reads and writes both
stop with `code: "ENCRYPTED_REFUSED"`. Add the note by hand in the Quire app
instead. (This is deliberate: the agent never holds your passphrase.)

## Install & build

```bash
cd mcp
npm install
npm run build
```

## Configuration

Create `~/.config/quire-mcp/config.json` (or set `$QUIRE_MCP_CONFIG` to another
path). See [`example-config.json`](./example-config.json):

```json
{
  "files": {
    "work": { "path": "~/notes/work.quire.html", "description": "Work notebook.", "default": true },
    "personal": { "path": "~/notes/personal.quire.html", "description": "Personal notebook." }
  },
  "allowFileCreation": false,
  "fileCreationBaseDir": "~/notes",
  "agentIdentity": { "name": "Claude", "icon": "🤖", "color": "#7c3aed" },
  "refuseEncrypted": true
}
```

- **files** — map of friendly name → `{ path, description?, default? }`. `~` is
  expanded. Exactly one entry may be `"default": true`; tools called without a
  `file` use it (or the sole file, if there's only one).
- **allowFileCreation** — must be `true` for `create_file` to work.
- **fileCreationBaseDir** — new files are confined to this directory.
- **agentIdentity** — `name`, `icon` (shown on the chip), and `color`.
- **refuseEncrypted** — keep `true` in v1.7.

## Register with an MCP client

Point your client at the built server over stdio. For Claude Desktop
(`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "quire": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/dist/index.js"]
    }
  }
}
```

Or, once published, `npx -y @quire/mcp-server`.

## Safety notes

- Writes are atomic; a crash mid-write cannot truncate your wiki.
- The server only ever replaces the data block — never the app code.
- All logging goes to **stderr**; stdout carries only the MCP protocol.
- The server never transmits your notes anywhere — it only touches local files.
