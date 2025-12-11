interface WorkerRequest {
    id: number;
    type: 'init' | 'run';
    url?: string;
    code?: string;
}

interface WorkerResponse {
    id: number;
    ok: boolean;
    status?: string;
    stdout?: string;
    stderr?: string;
    result?: string | null;
    error?: string;
}

let worker: Worker | null = null;
let workerInitPromise: Promise<void> | null = null;
let requestId = 0;
const pending = new Map<number, { resolve: (v: WorkerResponse) => void; reject: (e: any) => void }>();

function getWorker(): Worker {
    if (!worker) {
        const url = new URL('../workers/pyodide.worker.js', import.meta.url);
        // Use classic worker so importScripts is allowed inside the Pyodide worker.
        worker = new Worker(url, { type: 'classic' });
        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
            const resp = event.data;
            const handler = pending.get(resp.id);
            if (handler) {
                pending.delete(resp.id);
                handler.resolve(resp);
            }
        };
        worker.onerror = (err) => {
            console.error('Pyodide worker error:', err);
            pending.forEach(({ reject }) => reject(err));
            pending.clear();
        };
    }
    return worker;
}

async function sendToWorker(message: WorkerRequest): Promise<WorkerResponse> {
    const w = getWorker();
    return new Promise<WorkerResponse>((resolve, reject) => {
        pending.set(message.id, { resolve, reject });
        w.postMessage(message);
    });
}

export function initPyodide(pyodideUrl: string): void {
    if (workerInitPromise) return;
    workerInitPromise = (async () => {
        const resp = await sendToWorker({ id: ++requestId, type: 'init', url: pyodideUrl });
        if (!resp.ok) {
            throw new Error(resp.error || 'Failed to initialize Pyodide worker');
        }
    })();
}

export async function runPython(code: string): Promise<string> {
    try {
        if (!workerInitPromise) {
            return 'Error: Pyodide is not initialized. Please enable it in settings and wait for it to load.';
        }
        await workerInitPromise;
        const resp = await sendToWorker({ id: ++requestId, type: 'run', code });
        if (!resp.ok) {
            throw new Error(resp.error || 'Pyodide execution failed');
        }
        let output = resp.stdout || '';
        if (resp.stderr) {
            output += `--- STDERR ---\n${resp.stderr}`;
        }
        if (resp.result) {
            if (!output.includes(resp.result)) {
                output += `\n[Return Value]\n${resp.result}`;
            }
        }
        return output.trim() || '[No output]';
    } catch (error: any) {
        console.error('Python execution error:', error);
        const formattedError = `Python execution error:\n\`\`\`text\n${error.message}\n\`\`\``;
        return formattedError;
    }
}
