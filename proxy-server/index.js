import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { McpHub } from '../backend/mcp/McpHub.js';
import httpService from './httpService.js';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import si from 'systeminformation';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PROXY_PORT || 3001;
const execFileAsync = promisify(execFile);
const fsPromises = fs.promises;

// Voice script paths
const voiceScriptsDir = path.join(__dirname, '../scripts/voice');
const piperScriptPath = path.join(voiceScriptsDir, 'piper_say.sh');
const whisperScriptPath = path.join(voiceScriptsDir, 'whisper_transcribe.py');

// Helpers
const DESKTOP_DIR = path.join(os.homedir(), 'Desktop');
const CHAT_LOG_DIR = path.join(DESKTOP_DIR, 'LlamaHub_Chat_Logs');

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function sanitizeFileName(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255);
}

function ensureVoiceScript(scriptPath, label) {
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`${label} script not found at ${scriptPath}.`);
    }
}

const runPiperSpeak = (text) => {
    ensureVoiceScript(piperScriptPath, 'Piper');
    return new Promise((resolve, reject) => {
        const child = spawn(piperScriptPath, {
            cwd: path.join(__dirname, '..'),
            stdio: ['pipe', 'ignore', 'pipe'],
        });

        let stderr = '';
        child.stderr.on('data', chunk => { stderr += chunk.toString(); });
        child.on('error', reject);
        child.on('close', code => {
            if (code !== 0) {
                reject(new Error(stderr.trim() || `Piper script exited with code ${code}`));
            } else {
                resolve();
            }
        });

        child.stdin.write(text);
        child.stdin.end();
    });
};

const transcribeAudioWithWhisper = async (buffer, mimeType = 'audio/webm') => {
    ensureVoiceScript(whisperScriptPath, 'Whisper');
    const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'llamahub-voice-'));
    const inputExt = mimeType.includes('ogg') ? '.ogg' : mimeType.includes('wav') ? '.wav' : '.webm';
    const inputPath = path.join(tmpDir, `input${inputExt}`);
    const wavPath = path.join(tmpDir, 'input.wav');

    try {
        await fsPromises.writeFile(inputPath, buffer);
        await execFileAsync('ffmpeg', ['-y', '-i', inputPath, '-ar', '16000', '-ac', '1', wavPath]);
        const { stdout, stderr } = await execFileAsync('python3', [whisperScriptPath, '--audio', wavPath]);
        if (stderr) {
            console.warn('[Proxy] Whisper stderr:', stderr);
        }
        return stdout.trim();
    } catch (error) {
        if (error?.stderr) {
            console.error('[Proxy] Whisper/ffmpeg stderr:', error.stderr);
        }
        throw new Error(error.message || 'Failed to transcribe audio with Whisper.');
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
};

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const mcpHub = new McpHub();
mcpHub.initialize().catch(err => console.error('[MCP] Failed to init:', err));

app.get('/mcp/status', async (req, res) => {
    try {
        const status = await mcpHub.getStatus();
        res.json({ servers: status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/mcp/tools', async (req, res) => {
    try {
        const tools = await mcpHub.getTools();
        res.json({ tools });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/mcp/execute', async (req, res) => {
    const { tool, args } = req.body;
    try {
        console.log(`[Proxy] Executing MCP tool: ${tool}`, args ? `with args ${JSON.stringify(args)}` : 'with no args');
        const result = await mcpHub.execute(tool, args || {});
        res.json(result);
    } catch (error) {
        console.error('[Proxy] MCP Error:', error);
        res.status(500).json({ isError: true, message: error.message });
    }
});

// Minimal whitelist for system commands
const ALLOWED_COMMANDS = new Set(['df', 'ps', 'ping', 'kill']);

app.post('/proxy/system-command', async (req, res) => {
    const { command, args = [] } = req.body || {};
    if (!command || !ALLOWED_COMMANDS.has(command)) {
        return res.status(400).json({ message: 'Command not allowed.' });
    }
    try {
        const { stdout, stderr } = await execFileAsync(command, Array.isArray(args) ? args : []);
        res.json({ stdout: stdout || '', stderr: stderr || '' });
    } catch (error) {
        res.json({ stdout: error?.stdout || '', stderr: error?.stderr || error.message || 'Command failed.' });
    }
});

app.get('/proxy/system-stats', async (_req, res) => {
    try {
        const [cpu, mem, gpu] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.graphics()
        ]);
        const gpuLoad = gpu.controllers.find(c => c.utilizationGpu != null)?.utilizationGpu || 0;
        res.json({
            cpu: Math.round(cpu.currentLoad),
            mem: {
                total: mem.total,
                used: mem.used,
                usedPercent: Math.round((mem.used / mem.total) * 100)
            },
            gpu: Math.round(gpuLoad)
        });
    } catch (error) {
        res.status(500).json({ message: 'Could not retrieve system stats.' });
    }
});

// Research file endpoints
app.post('/proxy/research/start', async (req, res) => {
    try {
        const { topic } = req.body || {};
        if (!topic) return res.status(400).json({ message: 'Topic is required.' });
        ensureDir(DESKTOP_DIR);
        const safeName = sanitizeFileName(topic);
        const fileName = `${safeName || 'research'}_${Date.now()}.md`;
        const filePath = path.join(DESKTOP_DIR, fileName);
        fs.writeFileSync(filePath, `# Research: ${topic}\n\n`, 'utf8');
        res.json({ filePath });
    } catch (error) {
        console.error('[Proxy] research/start error:', error);
        res.status(500).json({ message: 'Failed to start research file.' });
    }
});

app.post('/proxy/research/append', async (req, res) => {
    try {
        const { filePath, content } = req.body || {};
        if (!filePath) return res.status(400).json({ message: 'filePath is required.' });
        const normalized = path.resolve(filePath);
        if (!normalized.startsWith(DESKTOP_DIR)) {
            return res.status(400).json({ message: 'Invalid path.' });
        }
        fs.appendFileSync(normalized, content || '', 'utf8');
        res.json({ message: 'Appended.' });
    } catch (error) {
        console.error('[Proxy] research/append error:', error);
        res.status(500).json({ message: 'Failed to append research file.' });
    }
});

app.post('/proxy/research/read', async (req, res) => {
    try {
        const { filePath } = req.body || {};
        if (!filePath) return res.status(400).json({ message: 'filePath is required.' });
        const normalized = path.resolve(filePath);
        if (!normalized.startsWith(DESKTOP_DIR)) {
            return res.status(400).json({ message: 'Invalid path.' });
        }
        const content = fs.readFileSync(normalized, 'utf8');
        res.json({ content });
    } catch (error) {
        console.error('[Proxy] research/read error:', error);
        res.status(500).json({ message: 'Failed to read research file.' });
    }
});

// Chat log saving
app.post('/proxy/logs/save', async (req, res) => {
    try {
        const { fileName, content } = req.body || {};
        if (!fileName || !content) {
            return res.status(400).json({ message: 'fileName and content are required.' });
        }
        ensureDir(CHAT_LOG_DIR);
        const safeName = sanitizeFileName(fileName);
        const filePath = path.join(CHAT_LOG_DIR, safeName);
        fs.writeFileSync(filePath, content, 'utf8');
        res.json({ filePath });
    } catch (error) {
        console.error('[Proxy] logs/save error:', error);
        res.status(500).json({ message: 'Failed to save chat log.' });
    }
});

// Voice endpoints (Piper TTS + Whisper STT)
app.post('/proxy/voice/speak', async (req, res) => {
    const text = (req.body?.text || '').trim();
    if (!text) {
        return res.status(400).json({ message: 'Text is required.' });
    }

    try {
        await runPiperSpeak(text);
        res.json({ message: 'Speech playback completed.' });
    } catch (error) {
        console.error('[Proxy] Piper error:', error);
        res.status(500).json({ message: error.message || 'Failed to execute Piper script.' });
    }
});

app.post('/proxy/voice/transcribe', async (req, res) => {
    const audioBase64 = req.body?.audio;
    const mimeType = req.body?.mimeType || 'audio/webm';

    if (!audioBase64) {
        return res.status(400).json({ message: 'Audio payload is required.' });
    }

    try {
        const buffer = Buffer.from(audioBase64, 'base64');
        const transcript = await transcribeAudioWithWhisper(buffer, mimeType);
        res.json({ text: transcript });
    } catch (error) {
        console.error('[Proxy] Whisper error:', error);
        res.status(500).json({ message: error.message || 'Failed to transcribe audio with Whisper.' });
    }
});

app.listen(PORT, () => {
    console.log(`LlamaHub Proxy Server running on http://localhost:${PORT}`);
});
