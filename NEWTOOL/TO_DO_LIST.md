# MCP Tool Build Queue (Francine)

Purpose:  
This file tracks MCP servers and custom tools that need to be built or wired into Francine.  
Agents should pick an unchecked item, implement it, then mark it as done.

---

## 1. New MCP Servers (external servers)

### [x] obsidian-mcp (Obsidian vault integration)
**Verified: 2025-11-30** Integrated as an external MCP server ('obsidian-mcp-server') after installing its Node.js dependencies, building it, and configuring 'backend/mcp/master.json' to launch it via stdio transport. Requires the 'Obsidian Local REST API' plugin to be installed and configured in Obsidian with an API key.

**Goal:**  
Let Francine read/write notes in an Obsidian vault (local-only, no cloud).

**Targets:**
- Server: `obsidian-mcp`
- Example tools:
  - `obsidian__create_note`
  - `obsidian__append_to_note`
  - `obsidian__search_notes` (optional)
  - `obsidian__list_notes` (optional)

**Agent tasks:**
1. Find a stable Obsidian MCP server (e.g. GitHub “mcp-obsidian”) and clone it.
2. Configure it to point at Jeff’s Obsidian vault directory (to be set in env or config).
3. Wire the server into the Francine proxy MCP config:
   - Add server command + args.
   - Add tool descriptions so Francine knows when to use it.
4. Test:
   - Ask Francine to “create a new Obsidian note called ‘Test Note’ with some content”.
   - Confirm the note appears in the vault.

---

### [x] google-mcp-server (Gmail & Google Calendar Integration)
**Verified: 2025-11-30** Integrated as an external Node.js MCP server ('google-mcp-server') providing tools for Gmail message listing and Google Calendar event listing. Involved creating a dedicated Node.js server, adapting existing Google API service logic, passing access tokens from the frontend, and bridging '/gmail' and '/gcal' commands. Required Google Cloud Console OAuth 2.0 Client ID setup and API key configuration.

**Goal:**
Let Francine access Gmail and Google Calendar information.

**Targets:**
- Server: `google-mcp-server`
- Tools:
  - `gmail__list_messages`
  - `calendar__list_events`

**Agent tasks:**
1. Create a Node.js MCP server project ('google-mcp-server').
2. Implement tools for Gmail and Google Calendar using Google API client libraries.
3. Handle Google OAuth access token passing from frontend to MCP tool calls.
4. Add server configuration to 'backend/mcp/master.json'.
5. Modify 'services/commandService.ts' to bridge '/gmail' and '/gcal' commands to new MCP tools.
6. Instruct user on obtaining and configuring Google Cloud API credentials.

---

### [ ] us-census-bureau-data-api-mcp (US Census data)

**Goal:**  
Give Francine access to public demographic/economic data for planning & analysis.

**Targets:**
- Server: `us-census-bureau-data-api-mcp` (or equivalent)
- Tools (example):
  - `census__search_datasets`
  - `census__get_statistics`

**Agent tasks:**
1. Clone the official/compatible US Census MCP server repo.
2. Get a **free US Census API key** and store it securely in `.env` (no hardcoding).
3. Register the server with Francine’s MCP hub.
4. Quick tests:
   - Ask for population of a specific county or ZIP.
   - Ask for basic economic indicators for a given region.

---

### [ ] arxiv-mcp (research papers)

**Goal:**  
Let Francine search arXiv and pull abstracts/metadata for AI/research projects.

**Targets:**
- Server: `simple-arxiv` / `arxiv-mcp` (name may vary)
- Tools (example):
  - `arxiv__search_papers`
  - `arxiv__get_paper_metadata`

**Agent tasks:**
1. Clone an arXiv MCP server (e.g. “simple-arxiv”).
2. Wire it into the MCP config (no API key required).
3. Test:
   - “Find me 5 papers on mixture-of-experts from 2024.”
   - “Summarize the abstracts and store them in Obsidian.”

---

### [ ] webresearch-mcp (multi-step web research)

**Goal:**  
Provide a higher-level “research agent” server that chains search + reading + summary.

**Targets:**
- Server: `webresearch-mcp` (or similar)
- Tools (example):
  - `webresearch__run_research`

**Agent tasks:**
1. Clone a WebResearch MCP server that integrates with a search backend (Tavily is OK).
2. Configure it to use Jeff’s existing Tavily key (if required).
3. Wire it into Francine’s MCP configuration with clear descriptions:
   - When to use deep research vs. plain Tavily.
4. Test:
   - “Run a deep web research on 32GB VRAM second-hand server builds and summarize best options.”

---

## 2. Custom Tools Behind Existing Servers

These are **logical tools** that will run via your existing MCP infrastructure (filesystem, python, etc.).

### [x] shopping__plan_update
**Verified: 2025-11-30** Implemented as a custom MCP tool via `custom_tools__shopping__plan_update` to manage a JSON-based shopping plan file.

**Goal:**  
Let Francine update a persistent “shopping plan” document (RAG/knowledge-based).

**Behavior:**
- Input: natural-language shopping changes (e.g. “add 10 lbs of chicken, budget $30”).
- Action:
  - Read shopping-plan file or note.
  - Append/update structured entries (item, qty, price, notes).
  - Save updated file.
- Output: short summary of changes and current totals where possible.

**Implementation notes for agent:**
- Use filesystem tools (read/write/append).
- Keep the plan in a simple structured format (Markdown table or JSON).

---

### [x] weather__quick_check
**Verified: 2025-11-30** Implemented via `/weather <city>` command using a proxy endpoint that curls `wttr.in`.

**Goal:**  
Fast, no-API-key weather lookup using `wttr.in`.

**Behavior:**
- Input: city name (or use Jeff’s default city if none given).
- Action:
  - Call `curl "https://wttr.in/<CITY>?format=3"` or a small Python equivalent.
- Output: short text, e.g. `South Bend: ☁️  -3°C`.

**Implementation notes for agent:**
- Wrap `curl` or Python `requests` in a small script (bash or Python).
- Expose an MCP tool, e.g. `weather__quick_check { city?: string }`.
- Make sure errors (no network, bad response) return a friendly message.

---

### [x] crypto__btc_chart
**Verified: 2025-11-30** Implemented via `/btc chart` command. Uses a python script to fetch data, append to a CSV, and generate a chart image. Exposed via a custom proxy endpoint.

**Goal:**
Generate and display a chart of Bitcoin's price history.

**Behavior:**
- Input: `/btc chart` command.
- Action:
  - Executes a Python script (`plot_btc.py`).
  - The script fetches the latest BTC price from CoinGecko.
  - Appends the new price to a local CSV file (`btc_price.csv`).
  - Generates an updated plot and saves it as `btc_chart.png`.
- Output: The generated chart image is displayed in the chat.

---

### [ ] bench__generate_inference_speed_test

**Goal:**  
Have Francine generate code/snippets to benchmark model or script performance.

**Behavior:**
- Input: language, framework, model name, batch size, etc.
- Output: code that:
  - Loads the model (or stub),
  - Times a fixed number of runs,
  - Prints throughput and latency.

**Implementation notes for agent:**
- Codegen-only at first (no automatic execution).
- Later, can wire into Python MCP and run inside the sandbox.
- Example tool:  
  `bench__generate_inference_speed_test { language, framework, model, batch_size }`.

---

### [ ] toolsmith__generate_bash_script

**Goal:**  
Let Francine design bash scripts as **tools to be created**, not auto-run.

**Behavior:**
- Input: description of the script (what it should do, inputs/outputs).
- Output: bash script text + suggested filename + usage.

**Implementation notes for agent:**
- This is meta: it **returns bash code**, it does not write files directly.
- Later, you can chain this with filesystem tools to actually create scripts.
- Example MCP interface:  
  `toolsmith__generate_bash_script { description: string } -> { filename: string, script: string, usage: string }`.

---

### [ ] code__grep_project

**Goal:**  
Search across Francine’s codebase (or any repo) for strings or patterns and return matches.

**Behavior:**
- Input: query string, optional path (default: current project).
- Action:
  - Run ripgrep/grep (or a Node/TS equivalent) in the project tree.
- Output:
  - List of files + line numbers + small context snippets.

**Implementation notes for agent:**
- Implement as a thin wrapper around `rg` or `grep` if available, or use Node’s fs+glob.
- Make sure to respect a “safe root” so it doesn’t wander into the whole filesystem.
- Example tool:  
  `code__grep_project { query: string, path?: string }`.

---

## 3. Already Existing / Confirmed Tools (for reference only)

These are **already present** or partially wired and should NOT be duplicated:

- Tavily MCP (`tavily__tavily-search`, `tavily__tavily-extract`, etc.).
- Playwright MCP:
  - `playwright-mcp__browse_website`
  - `playwright-mcp__extract_text`
  - `playwright-mcp__take_screenshot`
  - `playwright-mcp__full_page_screenshot`
  - `playwright-mcp__save_pdf`
- Deep research pipeline:
  - `deepresearch__submit`
  - `deepresearch__list_jobs`
  - `deepresearch__cancel`
  - `deepresearch__results`
- System resource snapshot / local monitoring (already implemented).
- Python interpreter MCP (Pyodide-based) – leave as-is for now.

---

## 4. Agent Instructions (Meta)

1. **Pick one unchecked item** from sections 1 or 2.
2. Implement the server/tool following the notes above.
3. Wire it into Francine’s MCP config (proxy + UI if needed).
4. Test it with at least 2–3 realistic prompts.
5. Document:
   - Repo link (if external),
   - Command to run the server (if separate),
   - Any env vars / keys required.
6. Mark the item as `[x]` and add a short “verified” note with date.
There is also parts for a crypto price chart for a macp...if you think its cool and not trash finish build please

_Jeff will keep extending this file with new ideas and cross items off as the stack fills out._
