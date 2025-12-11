import { type McpJob } from '../types';
import { useStore } from '../store';

async function fetchMcp(endpoint: string, options: RequestInit = {}, signal?: AbortSignal): Promise<any> {
    // FIX: The settings object contains `mcpServers` (an array), not `mcpSettings`.
    // This now finds the first enabled server to use for the request.
    const { mcpServers } = useStore.getState().settings;
    const activeServer = mcpServers.find(s => s.enabled);

    if (!activeServer || !activeServer.url) {
        throw new Error("No enabled MCP server with a valid URL is configured in settings.");
    }

    const url = `${activeServer.url.replace(/\/+$/, '')}/${endpoint}`;
    
    // FIX: Use the Headers constructor for robust handling of different HeadersInit types.
    // This resolves the TypeScript error related to spreading an array-like object.
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');

    if (activeServer.apiKey) {
        headers.set('Authorization', `Bearer ${activeServer.apiKey}`);
    }

    try {
        const response = await fetch(url, { ...options, headers, signal }); // Pass the signal here
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || `MCP Server responded with status ${response.status}`);
        }
        return data;
    } catch (error) {
        console.error(`[MCP Service] Error calling endpoint ${endpoint}:`, error);
        throw error;
    }
}

export async function submitJob(type: string, payload: Record<string, any>, signal?: AbortSignal): Promise<McpJob> {
    return fetchMcp('jobs', {
        method: 'POST',
        body: JSON.stringify({ type, payload }),
    }, signal);
}

export async function getJobStatus(jobId: string, signal?: AbortSignal): Promise<McpJob> {
    return fetchMcp(`jobs/${jobId}`, {}, signal);
}

export async function listJobs(signal?: AbortSignal): Promise<McpJob[]> {
    return fetchMcp('jobs', {}, signal);
}

export async function cancelJob(jobId: string, signal?: AbortSignal): Promise<{ message: string }> {
    return fetchMcp(`jobs/${jobId}`, {
        method: 'DELETE',
    }, signal);
}

export async function getResult(jobId: string, signal?: AbortSignal): Promise<any> {
    const job = await getJobStatus(jobId, signal);
    return job.result;
}