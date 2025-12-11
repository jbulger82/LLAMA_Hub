import { type SystemStats } from '../types';

export interface SystemCommandResult {
    stdout: string;
    stderr: string;
}

async function fetchFromProxy(proxyUrl: string | undefined, endpoint: string, options: RequestInit, signal?: AbortSignal) {
    const base = (proxyUrl && proxyUrl.trim()) || 'http://localhost:3001';
    try {
        const response = await fetch(`${base}/proxy${endpoint}`, { ...options, signal }); // Pass the signal here
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || `An unknown error occurred at the proxy server on endpoint ${endpoint}.`);
        }
        return result;
    } catch (error) {
        if (error instanceof TypeError) {
             throw new Error("Failed to connect to the LlamaHub proxy server. Is it running? Please use start.sh or start.bat to launch the application.");
        }
        throw error;
    }
}


export async function executeCommand(command: string, args: string[], recoveryMode: boolean, proxyUrl: string, signal?: AbortSignal): Promise<SystemCommandResult> {
    const result = await fetchFromProxy(proxyUrl, '/system-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, args, recoveryMode }),
    }, signal);
    return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
    };
}

export async function getSystemStats(proxyUrl: string, signal?: AbortSignal): Promise<SystemStats> {
    return fetchFromProxy(proxyUrl, '/system-stats', { method: 'GET' }, signal);
}

export async function startResearchFile(topic: string, proxyUrl: string, signal?: AbortSignal): Promise<{ filePath: string }> {
    return fetchFromProxy(proxyUrl, '/research/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
    }, signal);
}

export async function appendToResearchFile(filePath: string, content: string, proxyUrl: string, signal?: AbortSignal): Promise<void> {
    await fetchFromProxy(proxyUrl, '/research/append', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, content }),
    }, signal);
}

export async function readResearchFile(filePath: string, proxyUrl: string, signal?: AbortSignal): Promise<{ content: string }> {
    return fetchFromProxy(proxyUrl, '/research/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
    }, signal);
}

export async function saveChatLog(params: { fileName: string, content: string }, proxyUrl: string, signal?: AbortSignal): Promise<{ filePath: string }> {
    return fetchFromProxy(proxyUrl, '/logs/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    }, signal);
}

// --- New File Management Functions for Dev Mode ---

export async function createFile(filePath: string, proxyUrl: string, signal?: AbortSignal): Promise<{ message: string }> {
    return fetchFromProxy(proxyUrl, '/file/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
    }, signal);
}

export async function writeToFile(filePath: string, content: string, proxyUrl: string, signal?: AbortSignal): Promise<{ message: string }> {
    return fetchFromProxy(proxyUrl, '/file/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, content }),
    }, signal);
}

export async function deleteFile(filePath: string, proxyUrl: string, signal?: AbortSignal): Promise<{ message: string }> {
    return fetchFromProxy(proxyUrl, '/file/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
    }, signal);
}

export async function readFile(filePath: string, proxyUrl: string, signal?: AbortSignal): Promise<{ message: string, content?: string }> {
    return fetchFromProxy(proxyUrl, '/file/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
    }, signal);
}

export async function runSystemCommand(command: string, args: string[], recoveryMode: boolean, proxyUrl: string, signal?: AbortSignal): Promise<SystemCommandResult> {
    return executeCommand(command, args, recoveryMode, proxyUrl, signal);
}
