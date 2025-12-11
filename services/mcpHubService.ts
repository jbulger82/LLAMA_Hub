import { useStore } from '../store';

type McpStatusResponse = {
    servers: { name: string; status: string; error?: string }[];
};

type McpToolsResponse = {
    tools: { name: string; server: string; description?: string; inputSchema?: unknown; outputSchema?: unknown }[];
};

type McpExecuteResult = {
    ok: boolean;
    content: unknown;
    structuredContent: unknown;
    isError: boolean;
    message: string | null;
};

const getBaseUrl = () => {
    const { proxyUrl } = useStore.getState().settings;
    return proxyUrl?.replace(/\/+$/, '') || '';
};

async function fetchFromProxy<T>(endpoint: string, options: RequestInit, signal?: AbortSignal): Promise<T> {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
        throw new Error('Proxy URL is not configured.');
    }

    try {
        const response = await fetch(`${baseUrl}${endpoint}`, { ...options, signal });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result?.message || `MCP endpoint ${endpoint} failed with status ${response.status}`);
        }
        return result as T;
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error('Failed to reach the LlamaHub proxy. Ensure the proxy server is running on port 3001.');
        }
        throw error;
    }
}

export async function fetchMcpStatus(signal?: AbortSignal): Promise<McpStatusResponse> {
    return fetchFromProxy<McpStatusResponse>('/mcp/status', { method: 'GET' }, signal);
}

export async function fetchMcpTools(signal?: AbortSignal): Promise<McpToolsResponse> {
    return fetchFromProxy<McpToolsResponse>('/mcp/tools', { method: 'GET' }, signal);
}

export async function executeMcpTool(tool: string, args: Record<string, unknown> = {}, signal?: AbortSignal): Promise<McpExecuteResult> {
    if (!tool) {
        throw new Error('Tool name is required for MCP execution.');
    }
    return fetchFromProxy<McpExecuteResult>('/mcp/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool, args }),
    }, signal);
}
