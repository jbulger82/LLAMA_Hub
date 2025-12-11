import { LEGACY_OVERRIDES } from '../constants';

export type McpToolDef = { name: string; server: string; description?: string; inputSchema?: unknown; outputSchema?: unknown };

export const getSuppressedCommands = (mcpTools: McpToolDef[]): Set<string> => {
  const servers = new Set<string>();
  for (const tool of mcpTools) {
    const [server] = tool.name.split('__');
    if (server) servers.add(server);
  }
  const suppressed = new Set<string>();
  servers.forEach(server => {
    const overrides = LEGACY_OVERRIDES[server];
    if (overrides) {
      overrides.forEach(cmd => suppressed.add(cmd.trim()));
    }
  });
  return suppressed;
};

export const mapMcpToolsToUi = (mcpTools: McpToolDef[]) =>
  mcpTools.map(tool => {
    const [server, rawTool] = tool.name.split('__');
    const title = rawTool ? `${server}: ${rawTool}` : tool.name;
    return {
      id: `mcp_${tool.name}`,
      title,
      command: `/mcp ${tool.name} `,
    };
  });

export const isCommandSuppressed = (command: string, suppressed: Set<string>): boolean => {
  const token = (command || '').trim().split(/\s+/)[0];
  return suppressed.has(token);
};

export const formatToolPromptEntries = (mcpTools: McpToolDef[]): string[] => {
  return mcpTools.map(tool => {
    const [server, rawTool] = tool.name.split('__');
    const title = rawTool ? `${server}__${rawTool}` : tool.name;
    const args = (tool.inputSchema && typeof tool.inputSchema === 'object' && (tool.inputSchema as any).properties)
      ? Object.keys((tool.inputSchema as any).properties).join(', ') || 'args allowed'
      : 'args allowed';
    const desc = tool.description || 'MCP tool';
    return `- ${title}: ${desc}. Args: ${args}`;
  });
};
