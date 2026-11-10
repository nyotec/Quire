# Tests

Two Node-native test scripts (no framework). Both need the Quire app shell at
`../quire/dist/quire.html`, so build the app first:

```bash
(cd ../quire && npm run build)
cd ..            # back to mcp/
npm test         # builds, then runs both scripts
```

- **`smoke.mjs`** — drives the tool handlers directly against a wiki built from
  the real app shell: list/create/search/topics, agent-user reuse, folder
  routing, source attribution, encryption refusal, `create_file`, and a
  byte-level reparse proving the written file round-trips through lz-string the
  same way the browser app reads it.
- **`protocol.mjs`** — spins up the server over stdio through the MCP SDK client
  and checks the `tools/list` and `tools/call` handshake plus the error-envelope
  shape.
