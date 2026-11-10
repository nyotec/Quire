---
name: quire-capture
description: >-
  Capture notes into the user's Quire notebook via the Quire MCP server. Use
  when the user says "note this", "save to Quire", "capture this", "add to my
  notes", "/capture", or otherwise wants something written to their notebook —
  and for scheduled runs that should produce a daily/morning digest. The skill
  decides which file and topic a note belongs in and whether to confirm first;
  the MCP server (list_files, list_topics, search_leaves, create_leaf,
  create_file) does the reading and writing.
---

# Quire Capture

Help the user get notes into **their** Quire notebook. You are an assistant to
their note-taking, not a replacement for it: everything you write is attributed
to you (it shows an agent chip in Quire), and you route it where it belongs
rather than dumping it. The Quire app stays the source of truth.

## Principles

- **The user owns the notebook.** Prefer their existing topics and files over
  inventing new ones. When unsure where something goes, ask or follow the
  configured confirmation behavior — don't guess silently.
- **Agent-written content is visibly agent-written.** The MCP server attributes
  every leaf to your agent identity; don't try to impersonate the user.
- **Source attribution matters.** When a note is derived from an external item
  (a Jira ticket, an email, a web page, a Slack message), pass `source` to
  `create_leaf` so the note links back to where it came from.
- **One note = one leaf.** Don't batch unrelated thoughts into a single leaf.
  A digest is the one deliberate exception (see *Digest mode*).

## Prerequisites

This skill drives the **Quire MCP server**. Its tools must be available:
`list_files`, `list_topics`, `search_leaves`, `create_leaf`, `create_file`. If
they are not, tell the user to install and configure
[`@quire/mcp-server`](../../mcp/README.md) and stop — do not try to edit `.html`
files by hand.

The skill keeps its own small config at
`~/.config/quire-mcp/skill-config.json` (sibling to the MCP server's
`config.json`). Read it at the start of a capture. If it is missing or
`onboarded` is not `true`, run **First-run onboarding** before capturing.

## First-run onboarding

Ask exactly these three questions (one message, let the user answer briefly),
then write `skill-config.json`. Call `list_files` first so you can show the
user their configured notebooks.

1. **Organization model** — "How do you want me to file notes?"
   - `topics` — into folders/topics within a notebook (recommended)
   - `files` — into different notebooks by subject
   - `flat` — one notebook, organized by tags only
2. **Topics** — "What are your main areas?" Capture these as the starting
   `topics` list (e.g. *Projects, Meetings, Reading, Ideas*). For the `files`
   model, confirm which configured file is the default instead.
3. **Confirmation** — "Before I save, should I…"
   - `always` — always show you the note and wait for a yes
   - `ambiguous` — save directly when routing is obvious, ask only when unsure
     (recommended)
   - `silent` — just save and tell you where it went

Write the answers to `skill-config.json` (see *Config* below) with
`"onboarded": true`. Confirm in one line, then proceed with the pending
capture.

## Capture flow

For each thing to capture:

1. **Read config.** Load `skill-config.json`. If absent → onboarding.
2. **Extract the note.**
   - `title` — a short, specific line (not "Note" — summarize the content).
   - `body` — markdown. Preserve structure; use `- [ ]` for action items.
   - `tags` — a few lowercase tags from the content (no need for `#`).
   - `source` — if the note comes from an external item, set
     `{ type, id?, url?, title?, capturedAt? }`
     (`type` e.g. `jira`, `gmail`, `slack`, `web`, `manual`, `digest`).
3. **Route.**
   - **File:** `topics`/`flat` → the configured `defaultFile` (or the sole
     file). `files` model → pick the notebook whose description best fits; if
     none clearly fits, ask.
   - **Topic/folder:** call `list_topics` for the chosen file. Match the note to
     an existing folder by name/meaning. Only create a new folder (pass a new
     `folder` name to `create_leaf`) when nothing fits **and** it matches a
     configured topic or the user approves. For the `flat` model, omit `folder`.
   - **De-dup:** for anything that looks like an update to an existing note,
     `search_leaves` first; if you find the target, tell the user it exists and
     ask whether to add a new leaf or they'll update it in Quire (this skill
     only appends — it does not edit existing leaves).
4. **Confirm** per `confirmation`:
   - `always` → show `file · topic · title` and the body; wait for yes.
   - `ambiguous` → if file and topic are unambiguous, proceed; otherwise show
     the proposed routing and ask.
   - `silent` → proceed.
5. **Write.** Call `create_leaf` with `{ file?, title, body, tags?, folder?,
   source? }`. On `success: false`, surface `error`/`code` to the user:
   - `ENCRYPTED_REFUSED` → the notebook is locked; ask them to add it in Quire.
   - `CONFIG_ERROR` / unknown file → re-run `list_files` and fix routing.
6. **Report.** One line: what was saved and where (`Saved "Title" to work ›
   Projects`). Include the leaf's source if set.

## Digest mode (scheduled runs)

When invoked on a schedule (e.g. a morning run) rather than by a direct "note
this", produce a **single digest leaf** instead of many small ones.

1. Read `skill-config.json`; use its `digest` settings (`file`, `folder`,
   `sections`). If `digest.enabled` is false, do nothing.
2. Gather the items the run is meant to summarize (from whatever sources the
   scheduled prompt provides — calendar, inbox, tickets, etc.).
3. Build one markdown body with a heading per non-empty section, in the
   configured order. Use:
   - `- [ ]` for action items / tasks (Quire renders these as toggleable tasks),
   - `- ` bullets for notes,
   - inline links `[label](url)` back to sources.
   Example skeleton:
   ```markdown
   ## Tasks
   - [ ] Reply to [WMBT-1234](https://…) about the release
   ## Follow-ups
   - Ping Dana re: the design review
   ## Reading
   - [Interesting post](https://…) — why single-file apps win
   ```
4. `create_leaf` with `title` like `Morning digest — 2026-03-14`,
   `folder` = `digest.folder`, `tags: ["digest"]`, and
   `source: { type: "digest", capturedAt: <now> }`.
5. Update `lastDigestAt` in `skill-config.json` so the next run knows the
   window. Never create a second digest for the same day — if one already
   exists (`search_leaves` for today's digest title), skip or ask.

## Config

`~/.config/quire-mcp/skill-config.json` — see
[`example-config.json`](../example-config.json) and
[`config-schema.json`](../config-schema.json):

```json
{
  "onboarded": true,
  "organizationModel": "topics",
  "defaultFile": "work",
  "topics": ["Projects", "Meetings", "Reading", "Ideas"],
  "confirmation": "ambiguous",
  "digest": {
    "enabled": true,
    "file": "work",
    "folder": "Digests",
    "sections": ["Tasks", "Follow-ups", "Reading", "Notes"]
  },
  "lastDigestAt": null
}
```

This file is written by you during onboarding and updated after digests. It
never contains secrets. The MCP server's own `config.json` (files, agent
identity, encryption policy) is separate and user-owned — do not edit it.
