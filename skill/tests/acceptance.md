# Quire Capture — acceptance checks

Manual checks for the skill's behavior. They assume the Quire MCP server is
configured with at least one writable file (see `../../mcp`), and a test
notebook you don't mind writing to.

## Triggering

1. "note this: the build is flaky on Edge" → the skill activates and proposes a
   capture (does not answer as plain chat).
2. "save this to Quire" after a block of text → activates and captures that text.
3. "/capture" → activates.
4. A plain question ("what's the capital of France?") → the skill does **not**
   activate.

## First-run onboarding

1. With no `~/.config/quire-mcp/skill-config.json`, the first capture asks the
   three onboarding questions (organization model, topics, confirmation) and
   lists the configured notebooks (via `list_files`).
2. After answering, `skill-config.json` is written with `"onboarded": true` and
   the chosen values; the pending note is then captured.
3. A later capture does **not** re-ask onboarding.

## Routing

1. `topics` model: a note about an existing topic lands in that folder; the
   report reads `Saved "…" to <file> › <Topic>`.
2. A note with no matching topic → with `confirmation: ambiguous`, the skill
   asks where it should go rather than inventing a folder silently.
3. `files` model: a note is routed to the notebook whose description best fits;
   an ambiguous one prompts a choice.
4. `flat` model: the note is saved with tags and **no** folder.
5. A note captured from a URL/ticket includes `source` — in Quire the leaf shows
   the `↗ From …` footer linking back.

## Confirmation behavior

1. `always` → every capture shows the note and waits for a yes.
2. `ambiguous` → obvious routing saves directly; unclear routing asks.
3. `silent` → saves and reports in one line, no prompt.

## Digest mode

1. A scheduled run with `digest.enabled: true` creates **one** leaf titled
   `Morning digest — <date>` in the configured digest folder, with the
   configured sections (only non-empty ones), `- [ ]` tasks, and source links.
2. `lastDigestAt` is updated after the run.
3. A second run the same day does not create a duplicate digest (it detects the
   existing one via `search_leaves`).

## Error propagation

1. Target notebook is encrypted → `create_leaf` returns `ENCRYPTED_REFUSED`; the
   skill tells the user to add the note in Quire and does not retry.
2. MCP tools unavailable → the skill explains the server must be configured and
   does not attempt to edit `.html` files directly.
