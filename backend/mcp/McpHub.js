import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventSource } from 'eventsource';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { z } from 'zod';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Force the eventsource polyfill so we can send headers (Node 18+ native EventSource does not support headers)
global.EventSource = EventSource;

export class McpHub {
  constructor(options = {}) {
    this.registryPath = options.registryPath || path.join(__dirname, 'master.json');
    this.serverConfigs = [];
    this.clients = new Map();
    this.toolIndex = new Map();
    this.status = new Map();
  }

  async initialize() {
    await this.loadRegistry();
    await this.connectAll();
  }

  replaceEnvVars(config) {
    const str = JSON.stringify(config);
    const replaced = str.replace(/\$\{([^}]+)\}/g, (_, key) => process.env[key] || '');
    return JSON.parse(replaced);
  }

  async loadRegistry() {
    try {
      if (!fs.existsSync(this.registryPath)) {
        console.warn(`[MCP] Registry not found at ${this.registryPath}`);
        return;
      }
      const raw = await fs.promises.readFile(this.registryPath, 'utf8');
      const parsed = JSON.parse(raw);

      let configs = [];
      if (parsed?.servers) {
        configs = Array.isArray(parsed.servers)
          ? parsed.servers
          : Object.entries(parsed.servers).map(([name, cfg]) => ({ name, ...cfg }));
      }

      this.serverConfigs = configs.map(cfg => this.replaceEnvVars(cfg));
    } catch (error) {
      console.warn('[MCP] Error loading registry:', error.message);
    }
  }

  async connectAll() {
    this.toolIndex.clear();
    for (const cfg of this.serverConfigs) {
      await this.connectToServer(cfg);
    }
  }

  setStatus(name, status, error) {
    this.status.set(name, { status, error });
  }

  async connectToServer(config) {
    if (!config?.name || (!config?.type && !config?.transport)) return;
    if (config.enabled === false) return;

    try {
      const client = new Client({ name: 'francine-proxy', version: '1.0.0' }, { capabilities: {} });

      // Ensure param casing is correct
      if (config.name === 'tavily' && config.url) {
        config.url = config.url.replace('tavilyApikey', 'tavilyApiKey');
      }

      const transport = this.buildTransport(config);
      if (!transport) {
        this.setStatus(config.name, 'error', 'Unsupported transport');
        return;
      }

      const timeoutMs = 15000;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Connection timed out after ${timeoutMs}ms`)), timeoutMs)
      );

      console.log(`[MCP] Attempting connection to ${config.name}...`);
      await Promise.race([client.connect(transport), timeoutPromise]);

      let tools = [];
      try {
        const result = await client.listTools();
        tools = result.tools;
      } catch (validationError) {
        console.warn(`[MCP] Schema validation failed for ${config.name}, using raw fallback...`);
        const rawResult = await client.request({ method: 'tools/list' }, z.any());
        tools = rawResult.tools || [];
      }

      this.clients.set(config.name, { client, transport });
      this.setStatus(config.name, 'connected');

      tools.forEach(tool => {
        const namespacedName = `${config.name}__${tool.name}`;
        if (tool.inputSchema && !tool.inputSchema.type) {
          tool.inputSchema.type = 'object';
        }
        this.toolIndex.set(namespacedName, {
          serverName: config.name,
          toolName: tool.name,
          definition: {
            name: namespacedName,
            server: config.name,
            description: tool.description || '',
            inputSchema: tool.inputSchema || {},
          },
        });
      });

      console.log(`[MCP] ✅ Connected to ${config.name} (${tools.length} tools)`);
    } catch (error) {
      console.error(`[MCP] ❌ Failed to connect to ${config.name}:`, error.message);
      this.setStatus(config.name, 'error', error.message);
    }
  }

  buildTransport(config) {
    const transportType = config.type || config.transport;

    if (transportType === 'sse' && config.url) {
      return new SSEClientTransport(new URL(config.url), {
        requestInit: {
          headers: {
            'User-Agent': 'Francine-Client/1.0',
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
          fetch,
        },
        eventSourceInit: {
          https: { rejectUnauthorized: false },
        },
      });
    }

    if (transportType === 'stdio' && config.command) {
      const env = { ...process.env, ...config.env };
      return new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        cwd: config.cwd || process.cwd(),
        env,
        stderr: 'inherit',
      });
    }
    return null;
  }

  async getStatus() {
    return this.serverConfigs.map(server => ({
      name: server.name,
      status: this.status.get(server.name)?.status || 'disconnected',
      error: this.status.get(server.name)?.error,
      toolCount: Array.from(this.toolIndex.values()).filter(t => t.serverName === server.name).length,
    }));
  }

  async getTools() {
    return Array.from(this.toolIndex.values()).map(entry => entry.definition);
  }

  async execute(toolName, args = {}) {
    const mapping = this.toolIndex.get(toolName);
    if (!mapping) throw new Error(`Unknown tool: ${toolName}`);

    const clientBundle = this.clients.get(mapping.serverName);
    if (!clientBundle) throw new Error(`Server not connected: ${mapping.serverName}`);

    // Ensure arguments are an object for MCP calls
    let callArgs = args;
    if (typeof args === 'string') {
      try {
        callArgs = JSON.parse(args);
      } catch {
        // heuristic: map searches to query, otherwise wrap as arg
        if (toolName.toLowerCase().includes('search')) {
          callArgs = { query: args };
        } else {
          callArgs = { arg: args };
        }
      }
    }
    if (callArgs == null || typeof callArgs !== 'object' || Array.isArray(callArgs)) {
      callArgs = { arg: String(args) };
    }

    // Normalize common fields for Playwright tools
    const lowerTool = mapping.toolName.toLowerCase();
    if (callArgs.arg && !callArgs.url && (lowerTool.includes('screenshot') || lowerTool.includes('browse'))) {
      callArgs.url = callArgs.arg;
    }
    if (callArgs.arg && !callArgs.query && lowerTool.includes('search')) {
      callArgs.query = callArgs.arg;
    }
    // Trim URLs/queries if present
    if (callArgs.url && typeof callArgs.url === 'string') callArgs.url = callArgs.url.trim();
    if (callArgs.query && typeof callArgs.query === 'string') callArgs.query = callArgs.query.trim();

    console.log(`[MCP Hub] calling ${toolName} with args:`, callArgs);

    const result = await clientBundle.client.callTool({
      name: mapping.toolName,
      arguments: callArgs,
    });

    let message = null;
    if (result?.content && Array.isArray(result.content)) {
      const textParts = result.content
        .filter(item => item?.type === 'text' && item.text)
        .map(item => item.text);
      if (textParts.length) {
        message = textParts.join('\n');
      }
    }

    const ok = !result?.isError;
    return {
      ok,
      content: result?.content || null,
      structuredContent: result?.content || null,
      isError: result?.isError || false,
      message: message || (ok ? 'Completed.' : result?.message || null),
    };
  }
}
