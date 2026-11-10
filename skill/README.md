# Quire Capture skill

A Claude skill that captures notes into your [Quire](../quire) notebook through
the [Quire MCP server](../mcp). The skill owns **routing and judgment** — which
notebook and topic a note belongs in, whether to confirm first, how to format a
daily digest — while the MCP server owns the **capabilities** (reading and
writing the files).

## Layout

```
skill/
├── README.md              ← this file
├── config-schema.json     ← JSON Schema for the skill's config
├── example-config.json    ← a filled-in example
└── quire-capture/
    └── SKILL.md           ← the skill itself (frontmatter + instructions)
```

## What it does

- Triggers on "note this", "save to Quire", "capture this", "/capture", "add to
  my notes", and similar — and on scheduled runs for a morning **digest**.
- First-run onboarding asks three questions (organization model, topics,
  confirmation behavior) and saves them.
- For each capture it extracts a title/body/tags/source, routes to the right
  file and topic (via `list_topics` / `search_leaves`), confirms per your
  preference, and writes with `create_leaf`.
- Digest mode rolls a scheduled run's items into one dated leaf with sections,
  `- [ ]` tasks, and links back to sources.

## Install

1. Install and configure the MCP server (`../mcp/README.md`) so its five tools
   are available to your client.
2. Make this skill available to Claude. For Claude Code, place or symlink
   `quire-capture/` into a skills directory (e.g.
   `~/.claude/skills/quire-capture/`), or ship it as part of a plugin. The
   skill is the `quire-capture/SKILL.md` file and its frontmatter.
3. Say "note this: …" or "save this to Quire". On first use the skill will run
   onboarding and write `~/.config/quire-mcp/skill-config.json`.

## Config

The skill stores preferences at `~/.config/quire-mcp/skill-config.json`
(separate from the MCP server's `config.json`). See
[`config-schema.json`](./config-schema.json) and
[`example-config.json`](./example-config.json). It holds no secrets.

## Why skill + server are split

The server is a plain capability surface any MCP client can use: it reads and
writes Quire files and nothing more. The skill is the policy layer: it decides
where notes go and when to ask. Keeping them separate means you can use the
server without the skill (call the tools directly), and the skill's routing
logic can evolve without touching the file-format code.
