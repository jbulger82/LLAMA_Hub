import { StateCreator } from 'zustand';
import { type Message, type Chat, Role, type ResearchJob, type CanvasFile, type CommandResult, type PromptFormat } from '../../types';
import * as settingsStore from '../../services/settings';
import * as knowledgeStore from '../../services/knowledgeStore';
import * as speechService from '../../services/speechService';
import * as commandService from '../../services/commandService';
import * as researchService from '../../services/researchService';
import * as googleAuthService from '../../services/googleAuthService';
import * as localLlmService from '../../services/localLlmService';
import * as cloudLlmService from '../../services/cloudLlmService';
import * as systemService from '../../services/systemService';
import { LEGACY_OVERRIDES, MOCK_INITIAL_CHATS } from '../../constants';
import { parseAssistantResponse, type ParsedResponse } from '../../services/responseParser';
import { buildToolRoster } from '../../services/promptBuilder';
import { countTokens } from '../../services/tokenUtils';
import { AppState } from '../../store';
import { formatToolPromptEntries, getSuppressedCommands } from '../../lib/mcpUtils';

const DEFAULT_CONTEXT_TOKEN_LIMIT = 2048;

const VALID_COMMANDS = [
    '/search',
    '/canvas',
    '/python',
    '/save to memory',
    '/embed file',
    '/export memory',
    '/delete from memory',
    '/read knowledge',
    '/google',
    '/mcp',
    '/generate',
    '/deepresearch',
    '/curl',
    '/webscrape',
    '/gdrive',
    '/gmail',
    '/gcal',
];

const parseCommand = (text: string): string | null => {
    if (!text) return null;
    const lines = text.split('\n');

    for (const line of lines) {
        // Normalize line by removing bullets, labels, and optional "TOOL USED" prefix
        let cleanLine = line.trim()
            .replace(/^[\-\*\d\.\)]\s+/, '') // bullets or numbered lists
            .replace(/^(?:Reasoning|Action|Command|Thinking):\s*/i, '')
            .replace(/^TOOL USED[:\-]?\s*/i, '');

        // Find the first slash command token in the line
        const slashIndex = cleanLine.indexOf('/');
        if (slashIndex === -1) continue;

        cleanLine = cleanLine.slice(slashIndex).trim();

        for (const cmd of VALID_COMMANDS) {
            const cmdName = cmd.replace('/', '');
            const regex = new RegExp(`^/(${cmdName})(?:\\b|\\s)(.*)?$`, 'i');
            const match = cleanLine.match(regex);

            if (match) {
                // Use the full matched line (e.g., "/search foo bar") as the command.
                const commandContent = cleanLine.replace(/['"\`]+$/, '');
                return commandContent;
            }
        }
    }
    return null;
};

const getApiKey = (settings: settingsStore.Settings): string => {
    if (settings.developerMode) {
        if (settings.cloudProvider === 'openai') {
            return settings.dev_openAiApiKey;
        }
        // Default to gemini key for gemini or other cloud providers in dev mode
        return settings.dev_geminiApiKey;
    }
    return process.env.API_KEY || '';
};

const clampMessagesToTokenLimit = (messages: Message[], maxTokens: number): Message[] => {
    if (!maxTokens || maxTokens <= 0) return messages;
    const limited: Message[] = [];
    let tokenTotal = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        const tokens = countTokens(message.content || '');
        if (limited.length > 0 && tokenTotal + tokens > maxTokens) {
            break;
        }
        tokenTotal += tokens;
        limited.push(message);
        if (tokenTotal >= maxTokens) {
            break;
        }
    }
    if (limited.length === 0 && messages.length > 0) {
        return [messages[messages.length - 1]];
    }
    return limited.reverse();
};

const TITLE_FALLBACK_KEYS = ['title', 'response', 'summary', 'content', 'text', 'name'];

function findFirstStringValue(value: unknown): string | null {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : null;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findFirstStringValue(item);
            if (found) return found;
        }
        return null;
    }
    if (value && typeof value === 'object') {
        for (const key of TITLE_FALLBACK_KEYS) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                const found = findFirstStringValue((value as Record<string, unknown>)[key]);
                if (found) return found;
            }
        }
        for (const item of Object.values(value as Record<string, unknown>)) {
            const found = findFirstStringValue(item);
            if (found) return found;
        }
    }
    return null;
}

function sanitizeGeneratedTitle(rawTitle: string): string {
    let text = rawTitle.trim();
    if (!text) return '';

    text = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    if (!text) return '';

    if (text.startsWith('{') || text.startsWith('[')) {
        try {
            const parsed = JSON.parse(text);
            const extracted = findFirstStringValue(parsed);
            if (extracted) {
                text = extracted.trim();
            }
        } catch {
            /* ignore JSON parse errors */
        }
    }

    if (!text) return '';

    const firstLine = text.split('\n').find(line => line.trim().length > 0) || text;
    let normalized = firstLine;
    const colonIndex = normalized.indexOf(':');
    if (colonIndex > -1 && colonIndex < 25) {
        normalized = normalized.slice(colonIndex + 1).trim();
    }

    normalized = normalized.replace(/^["']+|["']+$/g, '').trim();
    if (normalized.length > 60) {
        normalized = normalized.slice(0, 60).trim();
    }
    return normalized;
}

async function generateTitleInBackground(chatId: string) {
    try {
        const { chats, settings, updateChatTitle } = (await import('../../store')).useStore.getState();
        const chat = chats.find(c => c.id === chatId);

        if (chat && chat.title === "New Chat" && chat.messages.length > 1) {
            const firstUserMessage = chat.messages.find(m => m.role === Role.USER)?.content || '';
            if (!firstUserMessage) return;

            const titlePrompt = `Generate a very short, concise title (4-5 words max) for the following user query: "${firstUserMessage}"`;
            const apiKey = getApiKey(settings);

            const titleStream = settings.aiProvider === 'cloud'
                ? cloudLlmService.directQueryStream(titlePrompt, {
                    ...settings,
                    model: settings.model,
                    temperature: 0.2,
                    topP: settings.topP,
                    topK: settings.modelTopK,
                    enableThinking: settings.enableThinking,
                  }, apiKey)
                : localLlmService.streamChatResponse({
                    ...settings,
                    url: settings.localLlmUrl,
                    model: settings.localLlmModelName,
                    messages: [{id:'title', role: Role.USER, content: titlePrompt}],
                    systemInstruction: "You generate short titles.",
                    localLlmPromptFormat: settings.localLlmPromptFormat,
                    temperature: 0.2
                  });
            
            let rawTitle = '';
            for await (const chunk of titleStream) { rawTitle += chunk; }
            const newTitle = sanitizeGeneratedTitle(rawTitle);
            if (newTitle) {
                updateChatTitle(chatId, newTitle);
            }
        }
    } catch (e) {
        console.error("Non-blocking error during title generation:", e);
    }
}

export interface ChatSlice {
    chats: Chat[];
    currentChatId: string | null;
    isLoading: boolean;
    isStopping: boolean;
    autoMemoryLocks: Record<string, boolean>;
    abortController: AbortController | null;
    currentChat: () => Chat | null;
    newChat: () => string;
    selectChat: (id: string) => void;
    deleteChat: (chatId: string) => void;
    clearAllChats: () => Promise<void>;
    archiveChat: (chatId: string, archive: boolean) => void;
    addMessageToChat: (message: Message, chatId?: string) => void;
    postStatus: (content: string, chatId?: string) => void;
    clearAllStatuses: (chatId?: string) => void;
    updateChatTitle: (chatId: string, title: string) => void;
    sendMessage: (text: string, options?: { attachedFile?: File; isResubmission?: boolean }) => Promise<void>;
    stopGeneration: () => void;
    editMessage: (messageId: string, newContent: string) => void;
    regenerateResponse: (assistantMessageIndex: number) => void;
  }

export const createChatSlice: StateCreator<AppState, [], [], ChatSlice> = (set, get) => ({
    chats: MOCK_INITIAL_CHATS,
    currentChatId: null,
    isLoading: false,
    isStopping: false,
    autoMemoryLocks: {},
    abortController: null,
    currentChat: () => get().chats.find(chat => chat.id === get().currentChatId) || null,
    newChat: () => {
        const newChat: Chat = {
          id: `chat_${Date.now()}`,
          title: 'New Chat',
          messages: [],
          isArchived: false,
          consecutiveToolErrors: 0,
        };
        set(state => ({
          chats: [newChat, ...state.chats],
          currentChatId: newChat.id,
          activeView: 'chat',
          isLoading: false,
        }));
        return newChat.id;
    },
    selectChat: (id) => set({ currentChatId: id, activeView: 'chat' }),
    deleteChat: (chatId) => {
        set(state => {
          const chatIndex = state.chats.findIndex(c => c.id === chatId);
          if (chatIndex === -1) return state; // No change if chat not found
      
          const newChats = state.chats.filter(c => c.id !== chatId);
      
          if (newChats.length === 0) {
            const newChatId = get().newChat();
            return {
                chats: get().chats,
                currentChatId: newChatId,
                activeView: 'chat'
            }
          }
      
          let newCurrentChatId = state.currentChatId;
          if (state.currentChatId === chatId) {
            const newIndex = Math.min(chatIndex, newChats.length - 1);
            newCurrentChatId = newChats[newIndex].id;
          }
          
          return { chats: newChats, currentChatId: newCurrentChatId };
        });
    },
    clearAllChats: async () => {
        await knowledgeStore.clearKnowledgeStore();
        set({
          chats: [],
          currentChatId: null,
          isSettingsOpen: false,
        });
        get().newChat();
    },
    archiveChat: (chatId, archive) => {
        set(state => ({
          chats: state.chats.map(chat =>
            chat.id === chatId ? { ...chat, isArchived: archive } : chat
          )
        }));
    },
    addMessageToChat: (message, chatId) => {
        const targetChatId = chatId || get().currentChatId;
        set(state => ({
          chats: state.chats.map(chat => 
            chat.id === targetChatId ? { ...chat, messages: [...chat.messages, message] } : chat
          )
        }));
    },
    postStatus: (content, chatId) => {
        const targetChatId = chatId || get().currentChatId;
        if (!targetChatId) return;
        const statusMessage: Message = {
          id: `status_${Date.now()}_${Math.random()}`,
          role: Role.ASSISTANT,
          content,
          type: 'status',
        };
        get().addMessageToChat(statusMessage, targetChatId);
    },
    clearAllStatuses: (chatId) => {
        const targetChatId = chatId || get().currentChatId;
        if (!targetChatId) return;
        set(state => ({
          chats: state.chats.map(chat =>
            chat.id === targetChatId ? { ...chat, messages: chat.messages.filter(m => m.type !== 'status') } : chat
          )
        }));
    },
    updateChatTitle: (chatId, title) => {
        set(state => ({
            chats: state.chats.map(chat => chat.id === chatId ? {...chat, title} : chat)
        }));
    },
    sendMessage: async (text, options) => {
        let activeChatId = get().currentChatId;
        if (!activeChatId) {
            activeChatId = get().newChat();
        }
        if (get().isLoading || !activeChatId) return;

        const controller = new AbortController();
        set({ isLoading: true, isStopping: false, abortController: controller });
        
        speechService.stop();
        let aiMessageId: string | null = null;
        let shadowMessages: Message[] = []; // ephemeral tool/response trace not committed to visible history
        const MAX_TOOL_LOOPS = 5;

        const streamToMessage = async (
            chatId: string,
            messageId: string,
            stream: AsyncGenerator<string, void, unknown>,
            options?: { parseInlineThinking?: boolean }
        ): Promise<ParsedResponse> => {
            const { parseInlineThinking = true } = options || {};
            let rawAccumulatedContent = '';
            let buffer = '';
            let animationFrameId: number | null = null;

            const applyStreamingUpdate = (parsed: ParsedResponse, isFinal: boolean) => {
                // Streaming updates only adjust the placeholder message; shadow traces are not committed here.
                set(state => ({
                    chats: state.chats.map(c => {
                        if (c.id !== chatId) return c;
                        return {
                            ...c,
                            messages: c.messages.map(m => {
                                if (m.id !== messageId) return m;
                                const thinkingUpdate = parseInlineThinking ? parsed.thinking : undefined;
                                return {
                                    ...m,
                                    ...(thinkingUpdate !== undefined ? { thinking: thinkingUpdate } : {}),
                                    content: parsed.content,
                                    toolInfo: undefined, // keep tool info out of visible message during streaming
                                    isThinking: !isFinal,
                                };
                            }),
                        };
                    }),
                }));
            };

            const updateDisplay = () => {
                rawAccumulatedContent += buffer;
                buffer = '';
                animationFrameId = null;
                const parsed = parseAssistantResponse(rawAccumulatedContent);
                applyStreamingUpdate(parsed, false);
            };

            for await (const chunk of stream) {
                if (get().isStopping) break;
                buffer += chunk;
                if (!animationFrameId) {
                    animationFrameId = requestAnimationFrame(updateDisplay);
                }
            }

            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            if (buffer) {
                updateDisplay();
            }

            const finalParsed = parseAssistantResponse(rawAccumulatedContent);
            applyStreamingUpdate(finalParsed, true);
            return finalParsed;
        };

        const createReasoningHandler = (chatId: string, messageId: string) => {
            let accumulated = '';
            return (chunk: string) => {
                accumulated += chunk;
                const normalized = accumulated.trim();
                set(state => ({
                    chats: state.chats.map(chat => {
                        if (chat.id !== chatId) return chat;
                        return {
                            ...chat,
                            messages: chat.messages.map(message =>
                                message.id === messageId
                                    ? {
                                        ...message,
                                        thinking: normalized || accumulated,
                                        isThinking: true,
                                    }
                                    : message
                            ),
                        };
                    }),
                }));
            };
        };

        const updateMessageInStore = (chatId: string, messageId: string, updates: Partial<Message>) => {
            set(state => ({
                chats: state.chats.map(c => {
                    if (c.id === chatId) {
                        const messages = c.messages.map(m => m.id === messageId ? { ...m, ...updates } : m);
                        return { ...c, messages };
                    }
                    return c;
                })
            }));
        };
        
        const injectToolOutputs = (messages: Message[]): Message[] => {
            return messages.map(m => {
                if (m.toolInfo?.output) {
                    const separator = m.content ? '\n\n' : '';
                    return {
                        ...m,
                        content: `${m.content || ''}${separator}[Tool Output]\n${m.toolInfo.output}`.trim(),
                    };
                }
                return m;
            });
        };

        const buildUniversalSystemPrompt = (
            basePrompt: string,
            settings: settingsStore.Settings,
            knowledgeContext?: string,
            mcpTools: { name: string; server: string; description?: string; inputSchema?: unknown; outputSchema?: unknown }[] = []
        ): string => {
            const suppressed = getSuppressedCommands(mcpTools);
            const isSuppressed = (cmd: string) => {
                const token = `/${cmd.trim().split(/\s+/)[0]}`;
                return suppressed.has(token);
            };

            const commandsList = buildToolRoster(settings)
                .filter(cmd => !cmd.startsWith('search'))
                .filter(cmd => !isSuppressed(cmd))
                .map(cmd => `/${cmd}`)
                .join('\n');

            const mcpToolLines = formatToolPromptEntries(mcpTools).join('\n');

            const knowledgeBlock = knowledgeContext?.trim()
                ? `\n\nCONTEXT:\n${knowledgeContext.trim()}\n`
                : '\n\nCONTEXT:\n(If needed, fetch details from saved knowledge with /read knowledge <title>)\n';

            const mcpBlock = mcpToolLines
                ? `\nMCP TOOLS (call with /mcp <tool> <args>):\n${mcpToolLines}\n`
                : '';

            return `You are LlamaHub, an advanced local AI.

CRITICAL PROTOCOL:
1. DECISION: When the user asks for an action (search, file edit, etc), you must use a tool.
2. INTERNAL CHECK: Before outputting, verify:
   - "Am I using the correct tool ID?"
   - "Is the JSON valid?"
   - "Did I strip all conversational text?"
3. OUTPUT FORMAT:
   - Output the command on its own line.
   - DO NOT wrap it in markdown blocks (no \`\`\`).
   - DO NOT add "Here is the command" or "I will do that".
   - Syntax: /mcp tool_name {"key":"value"}

AVAILABLE COMMANDS:
${commandsList}

${mcpBlock}${knowledgeBlock}

MCP USAGE RULES:
 - Use /mcp <tool> {...} for all external tools listed above.
 - If the user wants to search, use the 'tavily' or 'search' tool.

EXAMPLE:
User: Search for weather in Seattle.
Assistant: <think>User wants weather. Tool needed: tavily_search. Args: {"query":"weather Seattle"}. Protocol requires NO conversational text.</think>
/mcp tavily__tavily-search {"query":"weather Seattle"}

Persona: ${basePrompt?.trim() || 'Helpful assistant.'}`;
        };

        const supportsNativeReasoning = (format: PromptFormat): boolean =>
            format === 'openai-gemma2' || format === 'jinja';

        const processSearchResults = (toolOutput: string, userCommand: string): string => {
            let processed = toolOutput;
            // Remove redundant headers like "Search results from DuckDuckGo for..."
            // Also, remove specific headers from Tavily or custom searches
            processed = processed.split('\n').filter(line => 
                !line.startsWith('Search results from') &&
                !line.startsWith('**Direct Answer:**') &&
                !line.startsWith('**Search Results (Deep Context):**') &&
                !line.startsWith('Raw content from custom search endpoint for') &&
                !line.startsWith('Brave search results for')
            ).join('\n').trim();

            // Optionally, add a more generic header if some content remains
            if (processed && !processed.startsWith('1.') && !processed.startsWith('-')) { // Check if it already looks like a list
                 processed = `Relevant information from web search:\n${processed}`;
            }

            // Limit length to avoid overwhelming the LLM
            const MAX_SEARCH_RESULT_CHARS = 3000; 
            if (processed.length > MAX_SEARCH_RESULT_CHARS) {
                processed = processed.substring(0, MAX_SEARCH_RESULT_CHARS) + '\n\n... [Search results truncated]';
            }
            return processed;
        };

        const handleToolFollowUp = async (chatId: string, userCommand: string, toolOutput: string): Promise<void> => {
            get().postStatus(`Analyzing tool output...`, chatId);
            
            const toolFollowUpMessage: Message = {
                id: `msg_tool_followup_${Date.now()}`,
                role: Role.ASSISTANT,
                content: '',
                isThinking: true,
                toolInfo: { command: userCommand, output: toolOutput },
            };
            get().addMessageToChat(toolFollowUpMessage, chatId);
            const messageId = toolFollowUpMessage.id;
        
            const followUpChat = get().chats.find(c => c.id === chatId);
            if (!followUpChat) throw new Error("Chat not found for follow-up");
            
            const followUpSettings = get().settings;
            const baseFollowUpMessages = [...followUpChat.messages.filter(m => m.type !== 'status' && m.id !== messageId)].slice(-followUpSettings.contextWindowSize);
            const followUpTokenLimit = followUpSettings.maxContextTokens || DEFAULT_CONTEXT_TOKEN_LIMIT;
            const messagesForLlm = clampMessagesToTokenLimit(baseFollowUpMessages, followUpTokenLimit);
            const llmReadyMessages = injectToolOutputs(messagesForLlm);
            const followUpSupportsReasoning = supportsNativeReasoning(followUpSettings.localLlmPromptFormat);
            const followUpReasoningHandler = followUpSupportsReasoning ? createReasoningHandler(chatId, messageId) : undefined;
            
            let processedToolOutput = toolOutput;
            if (userCommand.startsWith('/search')) {
                processedToolOutput = processSearchResults(toolOutput, userCommand);
            }

            const followUpSystemPrompt = `You are LlamaHub. A tool was used to handle the user's request, and its output is below. Your ONLY task is to analyze this output and provide a final, conversational answer.
- If the output is data (like a list of files), summarize it clearly.
- If it's a Python error, explain the error to the user and suggest a fix.
- If it is a success message, you can acknowledge it.

**CRITICAL RULE: You MUST NOT use another tool. Your response must be the final answer for the user. Do not generate a \
<llamahub_tool_call>\
 tag.**

---
Tool Output ---
${processedToolOutput}`;
            
            let finalContentStream;
            const { settings } = get();
            const apiKey = getApiKey(settings);

            if (settings.aiProvider === 'localLlm') {
                finalContentStream = localLlmService.streamChatResponse({
                    ...settings,
                    url: settings.localLlmUrl,
                    model: settings.localLlmModelName,
                    messages: llmReadyMessages,
                    systemInstruction: followUpSystemPrompt,
                    localLlmPromptFormat: settings.localLlmPromptFormat,
                    stop: settings.stopTokens.split(',').map(s => s.trim()).filter(Boolean),
                    onReasoningChunk: followUpReasoningHandler,
                });
            } else {
                if (settings.cloudProvider === 'openai') {
                    finalContentStream = cloudLlmService.streamOpenAiCompatibleChatResponse(llmReadyMessages, settings, apiKey, followUpSystemPrompt, controller.signal); // Pass signal
                } else {
                    finalContentStream = cloudLlmService.streamGeminiChatResponse(llmReadyMessages, { systemInstruction: followUpSystemPrompt, model: settings.model, maxOutputTokens: settings.maxOutputTokens, temperature: settings.temperature, topP: settings.topP, topK: settings.modelTopK, enableThinking: settings.enableThinking, thinkingBudget: settings.thinkingBudget }, apiKey);
                }
            }
            
            const finalParsed = await streamToMessage(chatId, messageId, finalContentStream, { parseInlineThinking: !followUpSupportsReasoning });
        
            if (settings.readAloud && !get().isStopping) {
               speechService.speak(finalParsed.rawResponse);
            }
            get().clearAllStatuses(chatId);
        };


        try {
            let textForLlm = text;
            const { settings, postStatus } = get();

            if (options?.attachedFile && !text.toLowerCase().startsWith('embed file') && settings.aiProvider === 'localLlm') {
                const file = options.attachedFile;
                const shouldUseRagForAttachment = settings.useRagForAttachments && settings.ragEnabled;
                let embeddedAttachment = false;

                if (shouldUseRagForAttachment) {
                    try {
                        postStatus(`Embedding attached file "${file.name}" for retrieval...`);
                        await knowledgeStore.addFileWithMeta(file, status => postStatus(status));
                        postStatus(`📚 Attached file "${file.name}" embedded for retrieval.`);
                        embeddedAttachment = true;
                    } catch (e) {
                        const errorMessage = e instanceof Error ? e.message : String(e);
                        postStatus(`⚠️ Failed to embed "${file.name}". Falling back to inline read. (${errorMessage})`);
                    }
                }

                if (!embeddedAttachment) {
                    try {
                        postStatus(`Reading attached file "${file.name}" for local LLM...`);
                        const content = await knowledgeStore.extractTextFromFile(file);
                        textForLlm = `The user has attached a file named "${file.name}". Its content is:

---
${content}
---

Now, please respond to the user's request: ${text}`;
                    } catch (e) {
                        const errorMessage = e instanceof Error ? e.message : String(e);
                        postStatus(`⚠️ ${errorMessage}`);
                        textForLlm = text;
                    }
                }
            }

            if (!options?.isResubmission) {
                const userMessage: Message = { id: `msg_${Date.now()}`, role: Role.USER, content: text, type: 'user' };
                get().addMessageToChat(userMessage, activeChatId);
            }

            const chat = get().currentChat();
            if (!chat) throw new Error("Chat not found");

            if (settings.enableAutoMemory && settings.autoMemoryInterval > 0 && !options?.isResubmission && !get().isAutoSaving) {
                if (get().autoMemoryLocks[activeChatId]) {
                    // Auto-memory already running for this chat
                } else {
                    const lastSaveIndex = chat.lastAutoMemorySaveIndex || 0;
                    const messagesSinceSave = chat.messages.length - 1 - lastSaveIndex;
                    
                if (messagesSinceSave >= settings.autoMemoryInterval) {
                    set(state => ({
                        isAutoSaving: true,
                        autoMemoryLocks: { ...state.autoMemoryLocks, [activeChatId]: true },
                    }));
                    
                    const runAutoMemory = async (chatIdToProcess: string) => {
                        const controller = new AbortController();
                        // Allow more time for longer conversations to summarize.
                        const timeout = setTimeout(() => controller.abort(), 120000);
                        const postUnlock = () => set(state => {
                            const updatedLocks = { ...state.autoMemoryLocks };
                            delete updatedLocks[chatIdToProcess];
                            return { autoMemoryLocks: updatedLocks, isAutoSaving: false };
                        });
                        try {
                            const { chats, settings, postStatus } = get();
                            const chatToProcess = chats.find(c => c.id === chatIdToProcess);
                            if (!chatToProcess) return;

                            const memorySaveIndex = chatToProcess.messages.length;
                            const lastIndex = chatToProcess.lastAutoMemorySaveIndex || 0;
                            const messagesToSummarize = chatToProcess.messages
                                .slice(lastIndex, memorySaveIndex)
                                .filter(m => m.type !== 'status' && !m.isError);

                            if (messagesToSummarize.length < 2) return;

                            const conversationText = messagesToSummarize
                                .map(m => `${m.role === Role.USER ? settings.userName : 'LlamaHub'}: ${m.content}`)
                                .join('\n');
                            const summaryPrompt = `You are saving a memory for future recall. Read the conversation excerpt below and produce a concise, third-person summary capturing key facts, decisions, and outcomes. Do not invent details.\n\nCONVERSATION:\n${conversationText}\n\nSUMMARY:`;
                            
                            postStatus("Auto-summarizing conversation for memory...", chatIdToProcess);
                            const apiKey = getApiKey(settings);

                            const summaryStream = settings.aiProvider === 'cloud'
                                ? cloudLlmService.directQueryStream(summaryPrompt, settings, apiKey, { signal: controller.signal })
                                : localLlmService.streamChatResponse({ ...settings, url: settings.localLlmUrl, model: settings.localLlmModelName, messages: [{id:'summary', role: Role.USER, content: summaryPrompt}], systemInstruction: "You are a summarization AI.", localLlmPromptFormat: settings.localLlmPromptFormat, temperature: 0.2, signal: controller.signal });

                            let summary = '';
                            const reader = (async () => {
                                for await (const chunk of summaryStream) {
                                    summary += chunk;
                                }
                            })();

                            await Promise.race([reader, new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Auto-memory timeout'))))]);
                            summary = summary.trim();

                            if (summary) {
                                const memoryTitle = `Memory from chat: "${chatToProcess.title}" on ${new Date().toLocaleDateString()}`;
                                await knowledgeStore.addText(summary, memoryTitle);

                                const keepCount = Math.max(
                                    settings.contextWindowSize || 0,
                                    settings.autoMemoryInterval || 0
                                );
                                const maxContextTokens = settings.maxContextTokens || DEFAULT_CONTEXT_TOKEN_LIMIT;
                                let trimmedContext = false;

                                set(state => ({
                                    chats: state.chats.map(c => {
                                        if (c.id !== chatIdToProcess) return c;
                                        let trimmedMessages = c.messages;
                                        let dropCount = 0;
                                        if (keepCount > 0 && c.messages.length > keepCount) {
                                            dropCount = c.messages.length - keepCount;
                                            trimmedMessages = c.messages.slice(dropCount);
                                            trimmedContext = true;
                                        }
                                        const tokenClampedMessages = clampMessagesToTokenLimit(trimmedMessages, maxContextTokens);
                                        if (tokenClampedMessages.length < trimmedMessages.length) {
                                            dropCount += trimmedMessages.length - tokenClampedMessages.length;
                                            trimmedMessages = tokenClampedMessages;
                                            trimmedContext = true;
                                        }
                                        const adjustedIndex = Math.min(
                                            Math.max(memorySaveIndex - dropCount, 0),
                                            trimmedMessages.length
                                        );
                                        return {
                                            ...c,
                                            messages: trimmedMessages,
                                            lastAutoMemorySaveIndex: adjustedIndex,
                                        };
                                    })
                                }));

                                postStatus("✅ Conversation snippet saved to memory.", chatIdToProcess);
                                if (trimmedContext) {
                                    postStatus("🧹 Older context cleared after memory save.", chatIdToProcess);
                                }
                            }
                            
                            if (settings.logFullConversations) {
                                try {
                                    const logContent = `## Chat Log from "${chatToProcess.title}"\n\n**Saved on:** ${new Date().toString()}\n\n---\n\n` +
                                        messagesToSummarize
                                            .map(m => `**[${m.role === Role.USER ? settings.userName : 'LlamaHub'}]**\n\n${m.content}\n\n---`)
                                            .join('\n');
                                    
                                    const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
                                    const safeTitle = chatToProcess.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
                                    const fileName = `chat_log_${safeTitle}_${timestamp}.md`;
                                    
                                    await systemService.saveChatLog({ fileName, content: logContent }, settings.proxyUrl);
                                    postStatus("✍️ Chat log saved to Desktop.", chatIdToProcess);
                                } catch (logError) {
                                     console.error("Failed to save conversation log:", logError);
                                     postStatus("⚠️ Failed to save chat log to Desktop.", chatIdToProcess);
                                }
                            }

                        } catch (error) {
                            console.error("Auto-memory failed:", error);
                            postStatus("⚠️ Auto-memory failed to save.", chatIdToProcess);
                            set(state => {
                                const chat = state.chats.find(c => c.id === chatIdToProcess);
                                if (!chat) return { isAutoSaving: false };
                                return {
                                    isAutoSaving: false,
                                    chats: state.chats.map(c =>
                                        c.id === chatIdToProcess ? { ...c, lastAutoMemorySaveIndex: chat.messages.length } : c
                                    )
                                };
                            });
                        }
                        finally {
                            clearTimeout(timeout);
                            set(state => {
                                const updatedLocks = { ...state.autoMemoryLocks };
                                delete updatedLocks[chatIdToProcess];
                                return { autoMemoryLocks: updatedLocks, isAutoSaving: false };
                            });
                        }
                    };
                    
                    // Fire and forget to avoid blocking sendMessage flow
                    runAutoMemory(activeChatId);
                }
            }
            }
            
            const { researchJob } = get();
            if (researchJob?.status === 'confirm_factcheck') {
                set({ isLoading: false }); return;
            }
            
            get().clearAllStatuses(activeChatId);
            const commandContext = { addMessage: (message: Message) => get().addMessageToChat(message, activeChatId), postStatus: (message: string) => get().postStatus(message, activeChatId), setLoading: (isLoading: boolean) => set({ isLoading }), isRecoveryModeActive: get().isRecoveryModeActive, setResearchJob: get().setResearchJob, signal: controller.signal };
            const commandResult: CommandResult = await commandService.handleCommand(text, options?.attachedFile, settings, commandContext);

            if (commandResult.action === 'DEEP_RESEARCH_STARTED' || commandResult.action === 'TRIGGER_RECOVERY_MODAL') {
                if (commandResult.action === 'TRIGGER_RECOVERY_MODAL') get().openRecoveryModal();
                set({ isLoading: false }); return;
            }
            if (get().isRecoveryModeActive && commandResult.isHandled) {
                set({ isRecoveryModeActive: false });
                get().postStatus("Emergency Recovery Mode has been deactivated.", activeChatId);
            }

            const apiKey = getApiKey(settings);

            if (commandResult.isHandled) {
                const shouldShow = !!commandResult.message && (commandResult.isFinal || commandResult.llmFollowUp || commandResult.isCommandResponse);

                if (shouldShow) {
                    const assistantMsg: Message = {
                        id: `cmd_${Date.now()}`,
                        role: Role.ASSISTANT,
                        content: commandResult.message!,
                        type: 'assistant',
                        sourceLabel: commandResult.sourceLabel,
                        isError: commandResult.isError,
                        isCommandResponse: commandResult.isCommandResponse,
                    };
                    get().addMessageToChat(assistantMsg, activeChatId);
                }

                if (commandResult.isFinal) {
                    generateTitleInBackground(activeChatId);
                    set({ isLoading: false });
                    return;
                }
                if (commandResult.stream) {
                    aiMessageId = `msg_ai_${Date.now()}`;
                    get().addMessageToChat({ id: aiMessageId, role: Role.ASSISTANT, content: '', isThinking: true, sourceLabel: commandResult.sourceLabel }, activeChatId);
                    const streamedResult = await streamToMessage(activeChatId, aiMessageId, commandResult.stream);
                    shadowMessages.push({ id: aiMessageId, role: Role.ASSISTANT, content: streamedResult.rawResponse, type: 'assistant' });
                } else if (commandResult.llmFollowUp && commandResult.message) {
                    shadowMessages.push({ id: `tool_${Date.now()}`, role: Role.ASSISTANT, content: commandResult.message, type: 'assistant' });
                } else if (commandResult.message) {
                    shadowMessages.push({ id: `tool_${Date.now()}`, role: Role.ASSISTANT, content: commandResult.message, type: 'assistant' });
                }
                set({ isLoading: false }); 
                return;
            }

            const currentChat = get().currentChat();
            if (!currentChat) throw new Error("Chat not found after command check");

            let loopCount = 0;
            while (loopCount < MAX_TOOL_LOOPS) {
                const baseContextMessages = [...currentChat.messages.filter(m => m.type !== 'status')].slice(-settings.contextWindowSize);
                const contextTokenLimit = settings.maxContextTokens || DEFAULT_CONTEXT_TOKEN_LIMIT;
                let messagesForLlm = clampMessagesToTokenLimit(baseContextMessages, contextTokenLimit);

                if (textForLlm !== text) {
                    messagesForLlm[messagesForLlm.length - 1] = { ...messagesForLlm[messagesForLlm.length - 1], content: textForLlm };
                }

                const llmReadyMessages = injectToolOutputs(messagesForLlm);

                if (get().isCanvasOpen) {
                    const { canvasFiles, canvasActiveFileId } = get();
                    if (canvasFiles.length > 0) {
                        const activeFile = canvasFiles.find(f => f.id === canvasActiveFileId);
                        if (activeFile) {
                            const truncatedContent = activeFile.content.length > 4000 
                                ? activeFile.content.substring(0, 4000) + '... [Content Truncated]'
                                : activeFile.content;
                            const canvasContextMessage: Message = {
                                id: `canvas_context_${Date.now()}`,
                                role: Role.USER,
                                content: `The user has the file "${activeFile.name}" open in the Smart Canvas. Its content is:
---
${truncatedContent}
---
`,
                                type: 'context',
                            };
                            llmReadyMessages.splice(llmReadyMessages.length - 1, 0, canvasContextMessage);
                        }
                    }
                }

                const textForRag = commandResult.llmPrompt || textForLlm;
                const contextResult = settings.ragEnabled
                    ? await knowledgeStore.findRelevantContext(textForRag, { similarityThreshold: settings.similarityThreshold, topK: settings.topK }, (status) => get().postStatus(status, activeChatId))
                    : undefined;

                if (contextResult && contextResult.chunkCount > 0) {
                    get().postStatus(`Injecting ${contextResult.chunkCount} knowledge chunk${contextResult.chunkCount === 1 ? '' : 's'} (~${contextResult.tokenCount} tokens).`, activeChatId);
                }

                const knowledgeContext = contextResult?.text;
                const initialSystemInstruction = buildUniversalSystemPrompt(
                    settings.systemPrompt,
                    settings,
                    knowledgeContext,
                    get().mcpTools
                );


                get().clearAllStatuses(activeChatId);

                aiMessageId = `msg_ai_${Date.now()}`;
                get().addMessageToChat({ id: aiMessageId, role: Role.ASSISTANT, content: '', isThinking: true }, activeChatId);

                const nativeReasoningSupported = settings.aiProvider === 'localLlm' && supportsNativeReasoning(settings.localLlmPromptFormat);
                const primaryReasoningHandler = nativeReasoningSupported ? createReasoningHandler(activeChatId, aiMessageId) : undefined;

                let firstPassStream;
                if (settings.aiProvider === 'localLlm') {
                    firstPassStream = localLlmService.streamChatResponse({
                        ...settings,
                        url: settings.localLlmUrl,
                        model: settings.localLlmModelName,
                        messages: [...llmReadyMessages, ...shadowMessages],
                        systemInstruction: initialSystemInstruction,
                        localLlmPromptFormat: settings.localLlmPromptFormat,
                        stop: settings.stopTokens.split(',').map(s => s.trim()).filter(Boolean),
                        signal: controller.signal,
                        onReasoningChunk: primaryReasoningHandler,
                    });
                } else {
                    if (settings.cloudProvider === 'openai') {
                        firstPassStream = cloudLlmService.streamOpenAiCompatibleChatResponse([...llmReadyMessages, ...shadowMessages], settings, apiKey, initialSystemInstruction, controller.signal);
                    } else {
                        firstPassStream = cloudLlmService.streamGeminiChatResponse([...llmReadyMessages, ...shadowMessages], { systemInstruction: initialSystemInstruction, model: settings.model, maxOutputTokens: settings.maxOutputTokens, temperature: settings.temperature, topP: settings.topP, topK: settings.modelTopK, enableThinking: settings.enableThinking, thinkingBudget: settings.thinkingBudget }, apiKey, options?.attachedFile);
                    }
                }

                const parsed = await streamToMessage(activeChatId, aiMessageId, firstPassStream, { parseInlineThinking: !nativeReasoningSupported });
                shadowMessages.push({ id: `shadow_${Date.now()}`, role: Role.ASSISTANT, content: parsed.rawResponse, type: 'assistant' });

                // Lazy Search Fallback & Intent Recovery
                const currentContent = parsed.content || "";
                const commandFromScan = parseCommand(parsed.rawResponse);

                let commandToRun = parsed.toolCommand || commandFromScan; // Prefer explicit tool call, fall back to line-scan parser

                // CIRCUIT BREAKER CHECK
                const currentChatForCircuitBreaker = get().chats.find(c => c.id === activeChatId);
                if (commandToRun && currentChatForCircuitBreaker?.consecutiveToolErrors && currentChatForCircuitBreaker.consecutiveToolErrors >= 2) {
                    get().postStatus('Tool execution has failed multiple times. Aborting to prevent a loop.');
                    get().stopGeneration();
                    updateMessageInStore(activeChatId, aiMessageId!, { content: 'Tool execution failed repeatedly. Stopping generation.', isError: true, isThinking: false });
                    return;
                }

                if (commandToRun && !get().isStopping) {
                    if (loopCount >= MAX_TOOL_LOOPS) {
                        updateMessageInStore(activeChatId, aiMessageId!, { content: 'Stopping to avoid tool loop.', isError: true, isThinking: false });
                        set({ isLoading: false });
                        return;
                    }
                    loopCount += 1;

                    get().postStatus(`Using tool: \`${commandToRun}\``, activeChatId);
                    const toolResult: CommandResult = await commandService.handleCommand(commandToRun, undefined, settings, commandContext);
                    
                    if (toolResult.isError) {
                        set(state => ({
                            chats: state.chats.map(c => c.id === activeChatId ? { ...c, consecutiveToolErrors: (c.consecutiveToolErrors || 0) + 1 } : c)
                        }));
                    }
                    
                    if (toolResult.isFinal) {
                        generateTitleInBackground(activeChatId);
                        set({ isLoading: false });
                        return;
                    }

                    const toolOutput = toolResult.llmPrompt || toolResult.message || "Tool executed successfully but returned no output.";
                    
                    // Show the tool output in the chat (so images/results are visible) before the follow-up
                    if (toolResult.message) {
                        get().addMessageToChat({
                            id: `tool_msg_${Date.now()}`,
                            role: Role.ASSISTANT,
                            content: toolResult.message,
                            type: 'assistant',
                            isCommandResponse: toolResult.isCommandResponse,
                            isError: toolResult.isError,
                            sourceLabel: toolResult.sourceLabel,
                        }, activeChatId);
                    }
                    get().clearAllStatuses(activeChatId);

                    shadowMessages.push({
                        id: `shadow_tool_${Date.now()}`,
                        role: Role.USER,
                        content: `TOOL OUTPUT:\n${toolOutput}\n\nINSTRUCTION: Using the information above, write the final response to the user. Do NOT use any more tools.`,
                        type: 'user'
                    });

                    // loop again with expanded shadow context
                    continue;
                } else {
                    updateMessageInStore(activeChatId, aiMessageId!, {
                        content: parsed.content,
                        thinking: parsed.thinking || undefined,
                        isThinking: false,
                    });
                    if (settings.readAloud && !get().isStopping) {
                        speechService.speak(parsed.rawResponse);
                    }
                    generateTitleInBackground(activeChatId);
                    set({ isLoading: false });
                    return;
                }
            }
                
            // If we've gotten this far without throwing, reset any consecutive tool errors
            const finalChatState = get().chats.find(c => c.id === activeChatId);
            if (finalChatState?.consecutiveToolErrors && finalChatState.consecutiveToolErrors > 0) {
                set(state => ({
                    chats: state.chats.map(c => c.id === activeChatId ? { ...c, consecutiveToolErrors: 0 } : c)
                }));
            }
                
                
                
                        } catch (error) {
          console.error('Error in sendMessage:', error);
          const errorMessageContent = `Sorry, an error occurred...`;
          
          if (aiMessageId && activeChatId) {
            updateMessageInStore(activeChatId, aiMessageId, {
                content: errorMessageContent,
                isThinking: false,
                isError: true,
            });
          } else if (activeChatId) {
            get().addMessageToChat({
                id: `err_msg_${Date.now()}`,
                role: Role.ASSISTANT,
                content: errorMessageContent,
                isError: true,
            }, activeChatId);
          }
        } finally {
          set({ isLoading: false, isStopping: false, abortController: null });
          if(get().isRecoveryModeActive) {
            set({ isRecoveryModeActive: false });
            get().postStatus("Emergency Recovery Mode has been deactivated.", activeChatId);
          }
        }
    },
    stopGeneration: () => {
        get().abortController?.abort();
        set({ isStopping: true, isLoading: false, abortController: null });
        speechService.stop();
    },
    editMessage: (messageId, newContent) => {
        const { currentChatId, chats } = get();
        if (!currentChatId) return;

        const chat = chats.find(c => c.id === currentChatId);
        if (!chat) return;

        const messageIndex = chat.messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) return;

        const newMessages = chat.messages.slice(0, messageIndex); 
        
        newMessages.push({ ...chat.messages[messageIndex], content: newContent, isEdited: true });
        
        set(state => ({
          chats: state.chats.map(c => 
            c.id === currentChatId ? { ...c, messages: newMessages } : c
          )
        }));

        get().sendMessage(newContent, { isResubmission: true });
    },
    regenerateResponse: (assistantMessageIndex) => {
        const { currentChatId, chats } = get();
        if (!currentChatId) return;

        const chat = chats.find(c => c.id === currentChatId);
        if (!chat) return;

        const userMessageIndex = assistantMessageIndex - 1;
        if (userMessageIndex < 0 || chat.messages[userMessageIndex].role !== Role.USER) {
            console.error("Cannot regenerate; preceding message is not from the user.");
            return;
        }

        const userMessage = chat.messages[userMessageIndex];
        const newMessages = chat.messages.slice(0, userMessageIndex + 1);
        
        set(state => ({
          chats: state.chats.map(c => 
            c.id === currentChatId ? { ...c, messages: newMessages } : c
          )
        }));

        get().sendMessage(userMessage.content, { isResubmission: true });
    },
});
