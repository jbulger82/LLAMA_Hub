<img width="1920" height="1080" alt="llamauiSS1" src="https://github.com/user-attachments/assets/0da4d46a-2cdc-4fd2-806d-da24a32189ec" />


# LlamaHub — Ultimate Local `llama.cpp` Command Center

LlamaHub is an upgraded, batteries-included GUI for [`llama.cpp`](https://github.com/ggerganov/llama.cpp).

It’s built to be the local AI orchestrator you actually want to use: rich chat, Smart Canvas, local RAG, deep research, MCP tool ecosystem, browser automation, Google integrations, voice, and a full slash-command toolbox.

Everything runs locally by default — no cloud required unless you explicitly opt in.

---

## Why This Improves the Stock `llama.cpp` UI

- **Multi-provider orchestration**  
  Talk to your local `llama-server` (or any OpenAI-compatible endpoint) and optionally fall back to Gemini/OpenAI for reasoning, embeddings, or vision.

- **Embedded RAG UI**  
  Drag-and-drop files, embed, search, and amanage memory from the Knowledge Base view — no extra scripts required.

- **Smart Canvas**  
  Inline file workspace with previews (PDF/DOCX/Markdown/text/images), editing, and chat-aware context.

- **Deep Research worker**  
  Local multi-step research pipeline with optional cloud fact-checking; progress UI baked into chat.

- **MCP hub + Playwright**  
  Auto-discovers MCP servers (filesystem, Tavily, Playwright browser automation, Obsidian, Google MCP, custom tools).

- **Voice in/out**  
  Browser STT, Vosk WS, Whisper via proxy, Piper TTS — all wired to the chat input and proxy endpoints.

- **Slash commands everywhere**  
  Huge command palette for search, curl, web scraping, social posts, system stats, canvas, RAG, agents, code-gen, and more.

- **Persistent, local-first storage**  
  IndexedDB + localStorage, no telemetry. Recovery modal + chat log export to disk.

- **Extension bridge**  
  Chrome extension can stream page content/selection into chat for instant summarization/analysis.

- **Ready-to-run scripts**  
  `start.sh` / `start.bat` spin up proxy, Playwright MCP, and Vite dev server in one shot.

---

## Feature Inventory

### Chat & Prompting

- Local/cloud provider switch (OpenAI-compatible) with thinking budget + reasoning level toggle.
- System prompt templating, Jinja prompt format for `llama.cpp`, custom headers, context window controls.
- Token usage meter in the input, streaming responses, and stop-generation control.

### Memory / RAG

- `/embed file`, `/save to memory`, `/export memory`, `/delete from memory`.
- Worker-based chunking + embeddings (auto/local/cloud), cosine similarity search, threshold/topK tuning.
- Knowledge Base view to search, view, export, and delete documents.

### Smart Canvas

- `/canvas open | new | edit | list | read`  
- Multi-file workspace with previews (PDF/DOCX/images/etc.), inline editing, download/delete.

### Deep Research

- `/deepresearch <topic>`  
- Background worker orchestrates steps, optional cloud fact-check approval, writes research log via proxy.

### MCP Ecosystem

- Master config at `backend/mcp/master.json` (filesystem, Tavily, Playwright SSE, custom Python tools, Obsidian MCP, Google MCP).
- MCP status/tool discovery via proxy endpoints; tools surfaced in the UI.

### Web & Data

- `/search`, `/analyze website`, `/analyze links`, `/curl`, `/webscrape` (Scrapestack), `/download`.

### Google Integrations

- Drive, Gmail, Calendar commands (`/gdrive list`, `/gmail search`, `/gcal list`, etc.) via Google MCP + client auth (see Settings for keys).

### Voice

- **STT:** browser, Vosk WS, Whisper (proxy → `scripts/voice/whisper_transcribe.py` + ffmpeg + `faster-whisper`).
- **TTS:** browser, Piper (proxy → `scripts/voice/piper_say.sh`).

### Multi-Agent (optional)

- Agent slots with per-agent models/ports.
- Defaults map to local ports (e.g., Researcher/Web on 8080, others on 8081/8082).

### System & Utilities

- `/system status`, `/disk usage`, `/list processes`, `/kill process`, `/whoami`, `/report`.

### Extension

- Chrome extension (`extension/`) injects page/selection into chat via window messaging hooks in `App.tsx`.

### Persistence & Recovery

- Zustand store + IndexedDB/localStorage under key `llamahub_store`.
- Recovery modal and chat log export to Desktop via proxy.

---

## Architecture at a Glance

- **Frontend:** React 19 + Vite (`npm run dev` on port 5173)  
  - App shell in `App.tsx`, Zustand store in `store.ts`, RAG worker, research worker.

- **Proxy service:** `proxy-server/index.js` (port 3001)  
  - MCP hub, voice (Piper/Whisper), minimal system commands, research file append/read, chat log saving, system stats.

- **MCP Hub:** `backend/mcp/McpHub.js` + `backend/mcp/master.json`  
  - Connects STDIO/SSE MCP servers (filesystem/Tavily/Playwright/custom/Obsidian/Google).

- **Playwright MCP:** `playwright-mcp/index.js` (SSE on port 3005)  
  - Browser automation.

- **LLM endpoints (defaults):**  
  - `localLlmUrl` → port `8082` (chat)  
  - `localLlmEmbeddingUrl` → port `8080` (embeddings)  
  - Prompt format: Jinja.

- **Storage:**  
  - IndexedDB + localStorage (partialized in `store.ts`),  
  - Knowledge chunks via worker,  
  - Downloaded/exported files saved to Desktop via proxy.

---

## Prerequisites

- Node.js ≥ 18 and npm.
- [`llama.cpp`](https://github.com/ggerganov/llama.cpp) built with `llama-server`.
- Environment variables: create `proxy-server/.env` (or export vars) for proxy-specific overrides like `PROXY_PORT`, API keys, and service credentials. The frontend stores most configuration in the Settings modal.

**Recommended local chat server (8082):**

```bash
./llama-server \
  -m your-chat-model.gguf \
  --port 8082 \
  --ctx-size 131072 \
  --host 0.0.0.0 \
  --threads <n> \
  --n-gpu-layers <n> \
  --mlock
```

**Recommended embedding server (8080):**

Either enable embeddings on the chat server, or run a second instance:

```bash
./llama-server \
  -m your-embed-model.gguf \
  --port 8080 \
  --embedding \
  --ctx-size 2048 \
  --host 0.0.0.0
```

Optional but supported:

* OpenAI-compatible key and/or Gemini key (enter via Settings in developer mode).
* Voice stack:

  * `ffmpeg` in `PATH`
  * Python 3 + `pip install faster-whisper`
  * Piper binary + voice model (`PIPER_MODEL` env) for `scripts/voice/piper_say.sh`
* Playwright MCP: `npx playwright install chromium` on first run.
* Tavily API key for higher-quality web search (set in MCP env).
* Chrome extension: load `extension/` as an unpacked extension (Chrome/Edge → Extensions → Developer mode → Load unpacked → select the `extension` folder) to stream the current page/selection into chat.
* Git (if cloning via `git clone`).

---

## Quick Start (Dev)

1. **Clone & install**

```bash
git clone <your-repo-url> LlamaHub
cd LlamaHub
npm install
```

2. **Start your local LLMs**

```bash
# Chat server (8082)
./llama-server -m your-chat-model.gguf --port 8082 --ctx-size 131072 --host 0.0.0.0

# Embedding server (8080)
./llama-server -m your-embed-model.gguf --port 8080 --embedding --ctx-size 2048 --host 0.0.0.0
```

3. **Launch everything with the helper script**

* macOS/Linux: `./start.sh`
* Windows: `start.bat`

This will:

* start proxy server on `3001` (installs deps if missing),
* start Playwright MCP on `3005` (installs deps + Chromium),
* start Vite dev server on `5173`.

4. **Open the app**

Visit: `http://localhost:5173`

Open **Settings** (gear in sidebar) and set:

* Local LLM URL: `http://localhost:8082`
* Embedding URL: `http://localhost:8080`
* Provider: Local / Cloud and keys if using cloud.

---

## Manual Launch (Separate Terminals)

```bash
# Terminal 1: proxy (port 3001)
cd proxy-server
npm install
node index.js

# Terminal 2: Playwright MCP (port 3005, optional)
cd playwright-mcp
npm install
npx playwright install chromium
node index.js

# Terminal 3: frontend (port 5173)
cd ..
npm run dev
```

Production build:

```bash
npm run build
npm run preview   # serves dist on 4173 by default
```

---

## Configuration Guide (Settings Modal)

* **Theme & UI:** DaisyUI themes, font size, sidebar width, message density.
* **Model Routing:** `aiProvider` (local/cloud/dev), `cloudProvider`, `cloudApiUrl`, `model`, reasoning level/budget, system prompt.
* **Local LLM:** `localLlmUrl` (chat), `localLlmEmbeddingUrl`, prompt format (Jinja), headers JSON, context length, batch size, KV cache, RoPE settings, GPU layers, mmap/mlock, etc.
* **Generation Params:** temperature, top_p, top_k, repetition penalties, stop tokens, seed.
* **RAG:** toggle, provider (auto/local/cloud), similarity threshold, topK, chunk size/overlap, auto-memory cadence, knowledge path hint.
* **Voice:** enable STT/TTS; choose browser/Vosk/Whisper and Piper/system playback; set URLs and VAD / wake-word toggles.
* **Networking:** proxy URL (3001), proxy mode, CORS proxy, user-agent, search engine (Tavily/DuckDuckGo/Brave/Google/custom).
* **MCP Servers:** list/edit in UI; defaults include Playwright SSE on 3005 plus STDIO servers from `backend/mcp/master.json`.
* **Multi-agent:** enable and set per-agent ports/models/system prompts.
* **Integrations:** social platform credentials, Google client IDs/keys (can override via developer-mode fields).

All settings persist locally (IndexedDB/localStorage). Use the Emergency Recovery modal to reset if the store is corrupted.

---

## Using LlamaHub

* **Chat basics:**  
  Type normally, or use the Tools button to insert slash commands.

* **Smart Canvas:**  (Needs Work)
  * `/canvas open` then create/edit/list/read files;  
  * attach files via the paperclip or Tools → “Attach file.”  
  * Canvas files are available to the assistant as context.

* **Memory/RAG:**  
  * `/embed file <attach or drag file>`  
  * `/save to memory <text>`  
  * Ask questions and the assistant will use memory automatically;  
  * Manage items in the Knowledge Base view.

* **Deep Research:**  
  * `/deepresearch <topic>`  
  * Watch progress in the banner above the input; approve cloud fact-checking if prompted.

* **Web & data:**  
  * `/search <query>`, `/analyze website <url>`, `/curl <url>`, `/download <url>`.

* **Google MCP:**  
  * `/gdrive list`, `/gmail search <query>`, `/gcal list`.

* **Voice:**  
  * Click the mic in the input; pick STT provider in Settings.  
  * OS prerequisites:
    * Linux/macOS: `ffmpeg` in PATH; Piper binary + voice model (`PIPER_MODEL` env) for `scripts/voice/piper_say.sh`; Python 3 + `faster-whisper` for Whisper STT.
    * Windows: same voice stack; ensure your audio player (e.g., `aplay` equivalent) is reachable in PATH or set `PIPER_PLAYER`.
  * For Piper TTS, ensure `PIPER_MODEL` points to a valid `.onnx` voice.

* **Extension:**  
  * Load `extension/` as an unpacked Chrome extension;  
  * use the sidebar to send page/selection context — messages arrive automatically in the chat.

---

## Using the Gemini Dev API (Experimental OpenAI Provider)
<img width="1920" height="1080" alt="gem" src="https://github.com/user-attachments/assets/eacd0621-95a6-4763-95a7-7f88f81a518e" />


LlamaHub can talk to Google’s Gemini Dev API through Google’s OpenAI-compatible shim. To make this work, you **must** use the experimental dev provider and the correct base URL.

### 1. Select the right provider

In **Settings → AI Provider**:

* Set **AI Provider** to: `Dev Provider (Experimental OpenAI)`
  (or the equivalent “Dev / Experimental OpenAI” option in the UI)

Do **not** use the normal OpenAI provider for Gemini Dev – it will not work with the Google shim correctly.

### 2. Configure the Gemini Dev endpoint

Still in Settings, under the Dev/Experimental OpenAI provider fields:

* **Dev provider base URL** (or similar):

  ```text
  https://generativelanguage.googleapis.com/v1beta/openai/
  ```

* **Dev provider API key**:  
  Paste your **Gemini Dev API key** from the Google AI Studio / Developer console.

Once these are set:

* Click **Fetch models** (if there’s a button), or
* Let the UI auto-fetch the model list for this provider.

You should now see a **large list of Gemini models** (chat, reasoning, embedding, etc.) in the model dropdown.

> If you include screenshots, you can reference them here, e.g.  
> `docs/img/gemini-dev-provider.png`, `docs/img/gemini-model-list.png`.

---

## RAG, Embedding Models, and “Silent” Cloud Errors

LlamaHub’s RAG pipeline depends on **having a valid embedding model selected**. If RAG is enabled but no embedding model is configured, some cloud models will:

- fail to respond,
- throw errors into the chat pane,
- or appear to “hang” on the first request.

### If your cloud model loads but doesn’t respond

If you select a cloud model (Gemini/OpenAI/etc.) and:

- the chat panel shows an error, or
- you get no response at all,

check:

1. **Is RAG enabled?**

   * Go to **Settings → RAG / Memory**.
   * If you don’t have any embedding endpoint configured yet:

     * either **disable RAG**, or
     * set it to a provider that you know works (local embedding server or a cloud embedding model).

2. **Is an embedding model selected?**

   * If RAG is ON, make sure:

     * you’ve set a valid **Embedding URL** for local embeddings **or**
     * you’ve selected a cloud embedding model (e.g., a `text-embedding-*`
       model or Gemini embedding model) in the RAG/Memory section.

### Running without RAG

If you just want to chat with a model and don’t care about memory/RAG yet:

- Go to **Settings → RAG / Memory**
- Turn **RAG OFF**

With RAG disabled:

- The model can respond normally **without any embedding server**, local or cloud.
- This is a good way to confirm that your base chat config for a new model
  (including Gemini Dev) is working before you layer RAG on top.

---

## Model-Specific System Prompts & Tool Calling

Tool usage in LlamaHub is **not magic**—it’s heavily dependent on:

- how your model was trained (instruction following vs raw base),
- how you launched `llama-server` (context size, template, etc.),
- and **which system prompt you use**.

The UI ships with a **default system prompt** that has been tuned against
`gpt-oss-20b` on `llama.cpp` to make MCP tool calling reliable. If your model
is ignoring tools or calling them wrong, the system prompt is one of the first
things to check.

### Example llama.cpp Launch Commands (Proven Working Setup)

These are **example** launch commands that LlamaHub was developed and tested
against. Adjust paths, threads, etc. for your machine.

**Chat model (OSS-20B)**

```bash
/home/jeff/llama-b6962-bin-ubuntu-vulkan-x64/build/bin/llama-server \
  -m "/home/jeff/Desktop/models/gpt-oss-20b-Q4_K_M.gguf" \
  -ngl 99 -c 131072 --parallel 1 \
  --host 0.0.0.0 --port 8082 \
  -b 2056 -ub 256 \
  -fa auto \
  --temp 1.0 --top-p 0.9 --top-k 40 \
  --repeat-penalty 1.1 --repeat-last-n 200 \
  --cache-type-k q8_0 --cache-type-v q8_0 \
  --mlock \
  --threads 8 --threads-batch 8 \
  --chat-template-kwargs '{"reasoning_effort": "high"}' \
  --jinja
```

**Alternative chat model (Codex-distilled variant)**

```bash
/home/jeff/llama-b6962-bin-ubuntu-vulkan-x64/build/bin/llama-server \
  -m "/home/jeff/Desktop/models/gpt-oss-20b-gpt-5-codex-distill.F16.gguf" \
  -ngl 99 -c 131072 --parallel 1 \
  --host 0.0.0.0 --port 8082 \
  -b 2056 -ub 256 \
  -fa auto \
  --temp 1.0 --top-p 1.0 --top-k 40 \
  --repeat-penalty 1.0 --repeat-last-n 200 \
  --cache-type-k q8_0 --cache-type-v q8_0 \
  --mlock \
  --threads 24 --threads-batch 12 \
  --chat-template-file "/home/jeff/Desktop/models/francine_oss.jinja.txt" \
  --jinja
```

**Embedding server (Qwen 0.6B)**

```bash
/home/jeff/build-cpu/bin/llama-server \
  --embedding \
  -m "/home/jeff/Desktop/models/qwen3-embedding-0.6b-q4_k_m.gguf" \
  -c 8192 -b 512 --parallel 1 --host 0.0.0.0
```

You don’t have to use these exact models, but matching this **shape** (large
instruction-tuned chat model + separate embedding model, high context,
Jinja template) gives the best experience.

### Recommended System Prompt for Reliable Tool Calling

For models like `gpt-oss-20b` running on `llama.cpp`, this system prompt has
been validated to make MCP tools behave consistently.

> **Important:** The system prompt is **model-dependent**. This one works well
> for OSS-20B-style models. Smaller or very quantized models may need a simpler
> version. If tools fail, test with a stronger cloud model first to isolate
> whether it’s the model or the prompt.

You can set this as the **system prompt** for your local model in Settings:

```text
🔧 MCP TOOL CONTRACT (WITH MANDATORY PRE-TOOL REASONING)

You are running inside LlamaHub, a local multi-tool environment.
You can use MCP tools exposed by the host. They show up as functions.<tool_name> with JSON argument schemas.

Your job is:

Think first (short reasoning step) before every tool call.
Pick the correct tool if and only if it really helps.
Call it using a single slash command.
Never hallucinate tool names or arguments.

0. THINK BEFORE ANY TOOL CALL

Before you output any /mcp … line you MUST:

- Do a brief internal reasoning step:
  - Decide whether a tool is actually needed.
  - Decide which tool is best.
  - Decide what arguments are needed.

- Reflect that decision in a short “Thinking:” line in the answer (one or two sentences max), immediately above the command.

Only after that line, emit the /mcp … command as the last line of the message.

Examples:

Good:

Thinking: I need fresh real-world info for this, so I’ll use Tavily web search to grab a few relevant pages first.
/mcp tavily__tavily-search {"query": "current XRP vs BTC price action explanation", "max_results": 5}

Bad (NOT allowed):

- Immediately starting the message with /mcp … and no reasoning.
- A tool call with no explanation of why that tool was chosen.

You must never call a tool without at least a minimal reasoning step first.

1. MCP COMMAND FORMAT

When you decide to call an MCP tool, you must output a slash command as the last line of your message:

Format (exactly):

/mcp <tool_name> {JSON_ARGS}

Rules:

- The line must start with /mcp.
- The last line of the message MUST be the command.
- There must be no text after the command on that line.
- You may include a short “Thinking:” explanation above the command, but never on the same line.

Examples:

Thinking: The user wants a summary of that URL, so I’ll have the browser tool fetch the page and then I’ll summarize it.
/mcp browser__open {"id": "https://example.com/article.html"}

Thinking: I need to read this file from disk to answer.
/mcp filesystem__read-file {"path": "/home/jeff/Desktop/notes.txt"}

Never wrap this in backticks or code fences; it must be plain text.

2. FINDING AVAILABLE MCP TOOLS

You only use tools that actually exist in this environment.

They appear as:

- functions.tavily__tavily-search
- functions.filesystem__read-file
- functions.browser__open
- etc.

The tool name used in /mcp is the part after `functions.`

Examples:

- functions.tavily__tavily-search → `/mcp tavily__tavily-search {...}`
- functions.filesystem__write-file → `/mcp filesystem__write-file {...}`

Never invent a tool name that doesn’t exist in the tool list.

3. BUILDING JSON ARGUMENTS

Arguments for MCP tools must be valid JSON and follow the schema:

- Use double quotes ".
- No trailing commas.
- Only include keys defined in the schema.
- Respect types: strings, numbers, booleans, arrays, objects as specified.
- Include all required fields; include optional ones only if useful.

Examples:

Simple search:

Parameters: {"query": string, "max_results": number (optional)}

Thinking: I need a few recent sources about this topic.
/mcp tavily__tavily-search {"query": "python weakref tutorial", "max_results": 5}

Nested object:

Parameters:
{"url": string, "options": {"selector": string (optional)}}

Thinking: I only need the main article section from this page.
/mcp browser__scrape-page {"url": "https://example.com", "options": {"selector": "article"}}

No parameters:

Thinking: I just need to check connectivity of this MCP environment.
/mcp system__ping {}

Do not put comments inside JSON.

4. WHEN TO USE MCP TOOLS

Seriously consider tools (and think first) when:

- You need fresh or external info:
  - Web, APIs, live prices, current events, etc.
- You need to inspect or change environment state:
  - Filesystem, notes, configs, other local artifacts.
- The user explicitly asks:
  - “Search the web for…”
  - “Read this file…”
  - “Open this link and summarize…”
  - “Use tavily / browser / filesystem / etc.”

Do NOT use tools when:

- You can answer confidently from context / knowledge:
  - Explanations, teaching, brainstorming, planning.
- You are doing code generation/refactoring from content already in chat.
- The user explicitly wants an offline / “no tools” answer.

Even when you choose NOT to use a tool, you still reason first and then respond directly.

5. CHOOSING BETWEEN MCP TOOLS

In your reasoning step before the command, compare options:

- For general real-world info: prefer search tools like `tavily__tavily-search`.
- For specific URLs: prefer `browser` tools like `browser__open`, `browser__scrape-page`.
- For local files/configs: prefer `filesystem` tools like `filesystem__read-file`, `filesystem__write-file`.
- For domain-specific tools (e.g., `crypto__get-price`, `weather__get-forecast`), use them when appropriate.

Your “Thinking:” line should briefly state why that tool is the best choice.

6. BEHAVIOR AROUND MCP CALLS

Whenever you use a tool:

- Reason first:
  - Decide if a tool is needed.
  - Choose the tool.
  - Plan the arguments.

Then output:

- A short “Thinking:” line that reflects that decision (1–2 sentences).
- The `/mcp …` command as the final line.

Never:

- Start a response directly with `/mcp` and no reasoning.
- Output `to=functions.*` style internal tool call markup.
- Wrap the command in code fences.
- Describe a tool call in words but fail to actually emit the `/mcp` line when it’s clearly needed.

7. FAILURES & LIMITS

If a tool call fails or returns useless data:

- Explain that the call failed or returned nothing useful.
- Fall back on your own reasoning and any context you already have.

If a requested tool does not exist:

- Say plainly that this environment doesn’t expose that tool.
- If there is a close match, suggest that instead, with a new reasoning step + `/mcp` call if appropriate.
```

### Debugging Tool-Calling Issues
<img width="1920" height="1080" alt="gem3" src="https://github.com/user-attachments/assets/b77fbab4-8a36-4760-a250-667dac7b16cf" />

If your model isn’t using tools correctly:

1. **Check the system prompt**  
   Make sure you’re using a tool-aware prompt like the one above, not a tiny
   “You are a helpful assistant.” default.

2. **Try a cloud model as a control**  
   Temporarily switch the provider to a known-strong tool user (e.g. GPT-4 or
   Gemini Pro through the dev provider) and see if tools behave as expected.

   * If cloud works but your local model doesn’t → the problem is **your model
     prompt**, not LlamaHub.
   * If both fail → check MCP config, proxy logs, and tool schemas.

3. **Reduce complexity for smaller models**  
   For 7B / 8B or very heavily quantized models, you may need:

   * a shorter, simpler tool contract,
   * fewer instructions,
   * or to disable some tools entirely.

If you develop better prompts for a specific model family, please consider opening an issue or PR, or just email:

* **Author:** Jeff Bulger
* **Contact (questions / collabs / prompt suggestions):** `admin@jeffbulger.dev`

---

## Troubleshooting

* **CORS or 404 on LLM calls**  
  Check `localLlmUrl` / `localLlmEmbeddingUrl` and that `llama-server` is running on those ports.

* **Embeddings failing**  
  Ensure the embedding server supports embeddings (`--embedding`) and the model matches your URL.

* **Voice errors**  
  Confirm `ffmpeg` is installed; `faster-whisper` is in your Python env; `PIPER_MODEL` exists; `PIPER_BIN`/`PIPER_PLAYER` are in `PATH`.

* **Playwright MCP down**  
  Make sure port `3005` is free; rerun `npx playwright install chromium`.

* **Store corruption**  
  Use the Emergency Recovery modal or clear IndexedDB/localStorage for the site.

* **Proxy port collision**  
  Set `PROXY_PORT` in `proxy-server/.env` or export before running.

---

## Custom MCP Servers

Edit `backend/mcp/master.json`:

* Add servers under `servers` with `stdio` or `sse` transport.
* Provide env vars (e.g., `TAVILY_API_KEY`, `OBSIDIAN_API_KEY`).
* Playwright MCP SSE URL defaults to `http://localhost:3005/sse`.
* Custom Python MCP example included at `NEWTOOL/custom_tools_mcp.py`.

After editing, restart the proxy (it loads MCP config at startup).

---

## Data & Privacy

* No telemetry. All chat, knowledge, and settings live in your browser storage.
* Exported logs go to `~/Desktop/LlamaHub_Chat_Logs`.
* Proxy writes research files to your Desktop and validates paths to avoid escaping out of allowed directories.

---

## Scripts & Entrypoints

* `start.sh` / `start.bat` — orchestrate proxy + Playwright MCP + Vite dev server.
* `npm run dev` — frontend only.
* `npm run build` / `npm run preview` — production build/serve.
* `proxy-server/index.js` — proxy/MCP/voice/system endpoints.
* `playwright-mcp/index.js` — browser automation MCP (Chromium).
* `scripts/voice/piper_say.sh`, `scripts/voice/whisper_transcribe.py` — voice backend helpers.

---

## Credits & Contact

LlamaHub was created and is maintained by **Jeff Bulger** as a local-first cloud hybrid AI command center built on top of `llama.cpp`.

* **Author:** Jeff Bulger
* **Contact (questions / collabs / ideas):** `admin@jeffbulger.dev`
