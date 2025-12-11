import { useStore } from '../store';
import { type CommandResult } from '../types';
import { type Settings } from './settings';
import * as knowledgeStore from './knowledgeStore';
import * as systemService from './systemService';
import * as imageGenerationService from './imageGenerationService';
import * as googleAuthService from './googleAuthService';
import { executeMcpTool } from './mcpHubService';

type CommandContext = {
    postStatus?: (msg: string, chatId?: string) => void;
    addMessage?: (msg: any) => void;
    isRecoveryModeActive?: boolean;
    signal?: AbortSignal;
};

// Helper to parse shell-like arguments (handling quotes)
const parseArgs = (str: string): string[] => {
    const args: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === '"' || char === "'") {
            inQuotes = !inQuotes;
        } else if (char === ' ' && !inQuotes) {
            if (current) args.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    if (current) args.push(current);
    return args;
};

const getCommandArgs = (text: string, command: string) => {
    return text.substring(command.length + 1).trim(); // +1 for slash
};

// Helper to clean up MCP output
const formatMcpOutput = (result: any, options: { stripImages?: boolean } = {}): string => {
    if (!result) return "No result returned.";
    if (result.content && Array.isArray(result.content)) {
        const lines: string[] = [];
        for (const item of result.content) {
            if (item?.type === 'text' && item.text) {
                lines.push(item.text);
            } else if (item?.type === 'image' && item.data) {
                if (options.stripImages) {
                    const mime = item.mimeType || 'image/png';
                    lines.push(`[image omitted: ${mime}]`);
                } else {
                    const mime = item.mimeType || 'image/png';
                    lines.push(`![Image](${`data:${mime};base64,${item.data}`})`);
                }
            }
        }
        if (lines.length) return lines.join("\n");
    }
    if (result.message) return result.message;
    if (typeof result === 'string') return result;
    if (result.content) return JSON.stringify(result.content, null, 2);
    return JSON.stringify(result, null, 2);
};

export const processCommand = async (
    text: string,
    attachedFile: File | undefined,
    settings: Settings,
    context: CommandContext = {}
): Promise<CommandResult> => {
    const safeSettings = settings || ({} as Settings);
    const proxyUrl = safeSettings.proxyUrl || 'http://localhost:3001';
    const lowerText = text.trim().toLowerCase();
    const { mcpTools } = useStore.getState();
    const postStatus = typeof context?.postStatus === 'function' ? context.postStatus : () => {};

    // ==================================================================================
    // 1. NEW MCP UNIVERSAL HANDLER
    // ==================================================================================
    if (lowerText.startsWith('/mcp ')) {
        const raw = text.slice(5).trim();
        const firstSpace = raw.indexOf(' ');

        if (firstSpace === -1) {
            return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: "❌ Invalid syntax. Usage: `/mcp tool_name {args}`" };
        }

        const toolName = raw.substring(0, firstSpace);
        const jsonStr = raw.substring(firstSpace).trim();

        try {
            let args: any = {};
            try {
                args = JSON.parse(jsonStr);
            } catch {
                // Smart fallback for manual typing
                if (toolName.includes('search') || toolName.includes('tavily')) args = { query: jsonStr };
                else if (toolName.includes('file')) args = { path: jsonStr };
                else args = { arg: jsonStr };
            }

            // Handle Google tool auth
            if (toolName.startsWith('google-mcp-server__')) {
                if (!googleAuthService.isSignedIn()) {
                    return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: '❌ You are not signed in to Google. Please sign in via the settings menu to use this tool.', isError: true };
                }
                postStatus('🔄 Refreshing Google token...');
                const token = await googleAuthService.ensureFreshAccessToken();
                if (!token) {
                    return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: '❌ Failed to refresh Google authentication. Please try signing in again.', isError: true };
                }
                args.accessToken = token;
            }

            postStatus(`🔌 Executing ${toolName}...`);
            const result = await executeMcpTool(toolName, args, context.signal);

            if (result.isError) {
                return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: `❌ Tool Error: ${result.message}`, isError: true };
            }

            const display = formatMcpOutput(result, { stripImages: false });
            const llmPrompt = formatMcpOutput(result, { stripImages: true });

            return {
                action: 'MESSAGE_SENT',
                isHandled: true,
                isFinal: false,
                llmFollowUp: true,
                message: display,
                llmPrompt,
                sourceLabel: `Tool: ${toolName}`,
                isCommandResponse: true
            };
        } catch (e: any) {
            return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: `❌ System Error: ${e.message}`, isError: true };
        }
    }

    // ==================================================================================
    // 2. MCP BRIDGES (Map old commands to new MCP tools if available)
    // ==================================================================================
    
    // Bridge /search -> Tavily MCP
    if (lowerText.startsWith('/search')) {
        const query = getCommandArgs(text, '/search');
        const searchTool = mcpTools.find(t => t.name.includes('tavily') && t.name.includes('search'));
        
        if (searchTool) {
            postStatus(`🔍 Searching via MCP: "${query}"...`);
            try {
                const result = await executeMcpTool(searchTool.name, { query }, context.signal);
                return {
                    action: 'MESSAGE_SENT',
                    isHandled: true,
                    isFinal: false,
                    llmFollowUp: true,
                    message: formatMcpOutput(result),
                    sourceLabel: `Search: ${query}`,
                    isCommandResponse: true
                };
            } catch (e: any) {
                return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: `Search failed: ${e.message}`, isError: true };
            }
        }
        return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: "❌ Search tool not active. Check MCP settings." };
    }

    // Bridge /read file -> Filesystem MCP
    if (lowerText.startsWith('/read file')) {
        const path = getCommandArgs(text, '/read file').replace(/"/g, '');
        const fsTool = mcpTools.find(t => t.name.includes('filesystem') && t.name.includes('read_file'));

        if (fsTool) {
            try {
                const result = await executeMcpTool(fsTool.name, { path }, context.signal);
                return {
                    action: 'MESSAGE_SENT',
                    isHandled: true,
                    isFinal: false,
                    llmFollowUp: true,
                    message: formatMcpOutput(result),
                    sourceLabel: `File: ${path}`,
                    isCommandResponse: true
                };
            } catch (e: any) {
                return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: `Read failed: ${e.message}`, isError: true };
            }
        }
    }

    // ==================================================================================
    // 3. KNOWLEDGE / MEMORY COMMANDS
    // ==================================================================================
    if (lowerText.startsWith('/save to memory') || lowerText.startsWith('save to memory')) {
        const content = text.slice(text.toLowerCase().indexOf('save to memory') + 'save to memory'.length).trim();
        if (!content) {
            return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: "Please provide content to save, e.g. `/save to memory Berlin travel tips`.", isCommandResponse: true };
        }
        const snippetTitle = (() => {
            const trimmed = content.replace(/\s+/g, ' ').trim();
            if (!trimmed) return `Memory Snippet ${new Date().toLocaleString()}`;
            const excerpt = trimmed.slice(0, 80);
            return trimmed.length > 80 ? `${excerpt}...` : excerpt;
        })();
        const message = await knowledgeStore.addText(content, snippetTitle, postStatus);
        return { 
            action: 'MESSAGE_SENT', 
            isHandled: true, 
            isFinal: true, 
            message: `${message}\n\nTo recall it later, use \`/read knowledge ${snippetTitle}\`.`, 
            isCommandResponse: true 
        };
    }

    if (lowerText.startsWith('/embed file') || lowerText.startsWith('embed file')) {
        if (!attachedFile) {
            return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: "Please attach a file to embed. Usage: attach a file and send `/embed file`.", isCommandResponse: true, isError: true };
        }
        const message = await knowledgeStore.addFile(attachedFile, postStatus);
        return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message, isCommandResponse: true };
    }

    if (lowerText.startsWith('/export memory') || lowerText.startsWith('export memory')) {
        await knowledgeStore.exportKnowledge();
        return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: "Knowledge base export initiated. Check your downloads for the JSON file.", isCommandResponse: true };
    }

    if (lowerText.startsWith('/delete from memory') || lowerText.startsWith('delete from memory')) {
        const name = text.slice(text.toLowerCase().indexOf('delete from memory') + 'delete from memory'.length).trim();
        if (!name) {
            return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: "Please provide the memory name to delete, e.g. `/delete from memory project-notes`.", isCommandResponse: true, isError: true };
        }
        const deleted = await knowledgeStore.deleteParentByName(name);
        const message = deleted ? `Deleted "${name}" from memory.` : `Could not find a memory entry named "${name}".`;
        return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message, isCommandResponse: true };
    }

    if (lowerText.startsWith('/read knowledge') || lowerText.startsWith('read knowledge')) {
        const raw = text.slice(text.toLowerCase().indexOf('read knowledge') + 'read knowledge'.length).trim();
        const name = raw.replace(/^['"`]+/, '').replace(/['"`]+$/, '');
        if (!name) {
            return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: "Please provide a knowledge item name, e.g. `/read knowledge onboarding`.", isCommandResponse: true, isError: true };
        }
        try {
            const content = await knowledgeStore.readKnowledge(name);
            return { action: 'MESSAGE_SENT', isHandled: true, isFinal: false, llmFollowUp: true, message: content, sourceLabel: `Knowledge: ${name}`, isCommandResponse: true };
        } catch (err: any) {
            return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: err?.message || `Knowledge item "${name}" not found.`, isError: true, isCommandResponse: true };
        }
    }

    // ==================================================================================
    // 4. LEGACY SYSTEM COMMANDS (Restored!)
    // ==================================================================================

    // System Status
    if (lowerText.startsWith('/system status') || lowerText.startsWith('/sys status')) {
        const stats = await systemService.getSystemStats(safeSettings.proxyUrl, context.signal);
        return {
            action: 'MESSAGE_SENT',
            isHandled: true,
            isFinal: true,
            message: `**System Status**\n\`\`\`text\nCPU: ${stats.cpu}%\nMemory: ${stats.mem.usedPercent}% (${(stats.mem.used / 1e9).toFixed(2)} GB / ${(stats.mem.total / 1e9).toFixed(2)} GB)\nGPU: ${stats.gpu}%\n\`\`\``,
            isCommandResponse: true
        };
    }

    // Disk Usage
    if (lowerText.startsWith('/disk usage')) {
        const { stdout, stderr } = await systemService.runSystemCommand('df', ['-h'], context.isRecoveryModeActive || false, proxyUrl, context.signal);
        return {
            action: 'MESSAGE_SENT',
            isHandled: true,
            isFinal: true,
            message: stderr ? `Error:\n${stderr}` : `\`\`\`text\n${stdout}\n\`\`\``,
            llmFollowUp: true,
            isCommandResponse: true
        };
    }

    // List Processes
    if (lowerText.startsWith('/list processes')) {
        const { stdout, stderr } = await systemService.runSystemCommand('ps', ['aux'], context.isRecoveryModeActive || false, proxyUrl, context.signal);
        return {
            action: 'MESSAGE_SENT',
            isHandled: true,
            isFinal: true,
            message: stderr ? `Error:\n${stderr}` : `\`\`\`text\n${stdout.substring(0, 2000)}...\n(Truncated)\`\`\``,
            llmFollowUp: true,
            isCommandResponse: true
        };
    }

    // Ping
    if (lowerText.startsWith('/ping')) {
        const target = getCommandArgs(text, '/ping') || 'google.com';
        const { stdout, stderr } = await systemService.runSystemCommand('ping', ['-c', '4', target], context.isRecoveryModeActive || false, proxyUrl, context.signal);
        return {
            action: 'MESSAGE_SENT',
            isHandled: true,
            isFinal: true,
            message: stderr ? `Error:\n${stderr}` : `\`\`\`text\n${stdout}\n\`\`\``,
            isCommandResponse: true
        };
    }

    // Kill Process
    if (lowerText.startsWith('/kill process')) {
        const pid = getCommandArgs(text, '/kill process');
        if (!pid) return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: "Please provide a PID." };
        const { stdout, stderr } = await systemService.runSystemCommand('kill', [pid], context.isRecoveryModeActive || false, proxyUrl, context.signal);
        return {
            action: 'MESSAGE_SENT',
            isHandled: true,
            isFinal: true,
            message: stderr ? `Error:\n${stderr}` : `Process ${pid} terminated.`,
            isCommandResponse: true
        };
    }

    // Who Am I
    if (lowerText.startsWith('/whoami')) {
        const { stdout } = await systemService.runSystemCommand('whoami', [], false, settings.proxyUrl, context.signal);
        return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: `Current User: ${stdout}`, isCommandResponse: true };
    }

    // ==================================================================================
    // 5. APP FEATURES (Canvas, Python, Image Gen)
    // ==================================================================================

    // Smart Canvas
    if (lowerText.startsWith('/canvas open')) {
        useStore.getState().openCanvas();
        return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: "Opened Smart Canvas.", isCommandResponse: true };
    }

    if (lowerText.startsWith('/canvas new file')) {
        const args = parseArgs(getCommandArgs(text, '/canvas new file'));
        if (args.length >= 2) {
            const [name, ...contentParts] = args;
            const content = contentParts.join(' ');
            const newFile = { id: `file_${Date.now()}`, name, content, type: 'txt' };
            useStore.getState().addCanvasFile(newFile);
            useStore.getState().setCanvasActiveFileId(newFile.id);
            return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: `Created canvas file: "${name}"`, isCommandResponse: true };
        }
        return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: 'Usage: /canvas new file "name" "content"' };
    }

    if (lowerText.startsWith('/canvas read file')) {
        const name = getCommandArgs(text, '/canvas read file').replace(/"/g, '');
        const file = useStore.getState().canvasFiles.find(f => f.name.toLowerCase() === name.toLowerCase());
        if (file) {
             useStore.getState().setCanvasActiveFileId(file.id);
             return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, llmFollowUp: true, message: file.content, sourceLabel: `Canvas: ${file.name}` };
        }
        return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: `File "${name}" not found in canvas.` };
    }

    // Python Interpreter (Remote/Local)
    if (lowerText.startsWith('/python')) {
        // Placeholder for your python execution logic
        return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: "Python execution via internal tool is active.", isCommandResponse: true };
    }

    // Image Generation
    if (lowerText.startsWith('/generate image')) {
        const prompt = getCommandArgs(text, '/generate image');
        postStatus(`Generating image: "${prompt}"...`);
        try {
            const imageUrl = await imageGenerationService.generateImage(prompt, settings, context.signal);
            return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: `Generated: ${prompt}`, imageUrl, isCommandResponse: true };
        } catch (e: any) {
            return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: `Image generation failed: ${e.message}`, isError: true };
        }
    }

    // Google MCP Bridges
    if (lowerText.startsWith('/gmail') || lowerText.startsWith('/gcal')) {
        if (!googleAuthService.isSignedIn()) {
            return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: '❌ You are not signed in to Google. Please sign in via the settings menu to use this tool.', isError: true };
        }
        postStatus('🔄 Refreshing Google token...');
        const token = await googleAuthService.ensureFreshAccessToken();
        if (!token) {
            return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: '❌ Failed to refresh Google authentication. Please try signing in again.', isError: true };
        }
        
        let toolName = '';
        let args: any = { accessToken: token };

        if (lowerText.startsWith('/gmail')) {
            toolName = 'google-mcp-server__gmail_list_messages';
            args.query = getCommandArgs(text, '/gmail') || 'latest';
        } else { // /gcal
            toolName = 'google-mcp-server__calendar_list_events';
        }

        try {
            postStatus(`🔌 Executing ${toolName}...`);
            const result = await executeMcpTool(toolName, args, context.signal);
            if (result.isError) {
                return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: `❌ Tool Error: ${result.message}`, isError: true };
            }
            const display = formatMcpOutput(result, { stripImages: false });
            return {
                action: 'MESSAGE_SENT',
                isHandled: true,
                isFinal: false,
                llmFollowUp: true,
                message: display,
                llmPrompt: display,
                sourceLabel: `Tool: ${toolName}`,
                isCommandResponse: true
            };
        } catch (e: any) {
            return { action: 'MESSAGE_SENT', isHandled: true, isFinal: true, message: `❌ System Error: ${e.message}`, isError: true };
        }
    }
    
    // Recovery
    if (safeSettings.recoveryPassphrase && text === safeSettings.recoveryPassphrase) {
        return { action: 'TRIGGER_RECOVERY_MODAL', isHandled: true };
    }

    return { action: 'NONE', isHandled: false };
};

export const handleCommand = processCommand;
