# MCP Cleanup Plan

1) Lock registry to working stdio servers
- Set `backend/mcp/master.json` to the known-good stdio configs for filesystem and tavily-mcp@latest (with current test key).
- Keep transports as stdio only to avoid SSE flakiness.

2) Route legacy slash commands to MCP
- Remove legacy handlers for `/search`, `/webscrape`, `/curl`, `/read file`, `/list files`, `/create file` in `store/slices/chatSlice.ts`.
- Add a mapping layer: legacy slash commands → MCP tool names/args (e.g., `/search q` → `tavily__search` with { query: q }, `/read file path` → `filesystem__read_file` with { path }).
- Execute via existing MCP execute path to keep “muscle memory” commands working on the new engine.

3) Prompt slimming for 14b/20b
- In `lib/mcpUtils.ts`, generate concise tool prompt lines (no full schemas): `- name: desc | args: keys...` (e.g., tavily__search, filesystem__read_file).

4) Verification
- Ensure stdio transports pass config env; no direct `/api/system-command` usage for file ops.
- Confirm MCP tools render in UI and commands map correctly.
