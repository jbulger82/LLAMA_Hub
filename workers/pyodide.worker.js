let pyodide = null;
let initializing = false;

self.onmessage = async (event) => {
    const { id, type, url, code } = event.data || {};

    const respond = (payload) => {
        self.postMessage({ id, ...payload });
    };

    try {
        if (type === 'init') {
            if (pyodide || initializing) {
                respond({ ok: true, status: 'already-initialized' });
                return;
            }
            initializing = true;
            importScripts(url);
            pyodide = await self.loadPyodide();
            initializing = false;
            respond({ ok: true });
            return;
        }

        if (type === 'run') {
            if (!pyodide) {
                respond({ ok: false, error: 'Pyodide not initialized' });
                return;
            }
            let stdout = '';
            let stderr = '';
            pyodide.setStdout({ batched: (s) => (stdout += s + '\n') });
            pyodide.setStderr({ batched: (s) => (stderr += s + '\n') });
            const result = await pyodide.runPythonAsync(code);
            respond({ ok: true, stdout, stderr, result: result === undefined ? null : String(result) });
            return;
        }

        respond({ ok: false, error: 'Unknown message type' });
    } catch (error) {
        respond({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
};
