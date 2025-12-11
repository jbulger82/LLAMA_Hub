import { type Message, Role, type PromptFormat, type PromptTemplateOverrides } from "../types";
import { chatService } from './chatService';
import { getBaseUrl, parseHeaders } from './utils';
import { buildRawPrompt } from "./promptBuilder";
import type { Settings } from "./settings";

export interface LocalLlmConfig {
    url: string;
    model: string;
    messages: Message[];
    localLlmPromptFormat: PromptFormat;
    customPromptTemplates?: PromptTemplateOverrides;
    systemInstruction?: string;
    temperature?: number;
    topP?: number;
    topK?: number;
    repetitionPenalty?: number;
    maxOutputTokens?: number;
    typicalP?: number;
    seed?: number;
    stop?: string[];
    customHeaders?: string;
    signal?: AbortSignal;
    requestTimeoutMs?: number;
    onReasoningChunk?: (chunk: string) => void;
    // Add other fields from Settings that are used by chatService.sendMessage
    [key: string]: any;
}

// We now rely on the llama.cpp server's native chat_template for all models.
// Always use the chat completion endpoint instead of building custom raw prompts.
const CHAT_COMPLETION_FORMATS = new Set<PromptFormat>([
    'openai-gemma2',
    'jinja',
    'llama3',
    'chatml',
    'gemma',
    'deepseek-coder',
    'gpt-oss',
    'mirothinker',
]);
const DEFAULT_KEEP_ALIVE_SECONDS = 300;

const shouldUseChatCompletions = (format: PromptFormat): boolean => CHAT_COMPLETION_FORMATS.has(format);

export async function getEmbeddings(text: string, config: { url: string, model: string, customHeaders?: string }): Promise<number[]> {
  const headers = {
    'Content-Type': 'application/json',
    ...parseHeaders(config.customHeaders),
  };
  const baseUrl = getBaseUrl(config.url);
  const response = await fetch(`${baseUrl}/v1/embeddings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      input: text,
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Embedding API error (${response.status}): ${errText}`);
  }
  const data = await response.json();
  return data.data[0]?.embedding || [];
}

const parseOptionalNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
};

const parseOptionalBoolean = (value: unknown): boolean | undefined => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
    }
    return undefined;
};

const parseKeepAliveSeconds = (value?: string): number | undefined => {
    if (!value) return DEFAULT_KEEP_ALIVE_SECONDS;
    if (value === 'forever') return -1;
    const unit = value.slice(-1);
    const numeric = Number(value.slice(0, -1));
    if (!Number.isFinite(numeric)) {
        return DEFAULT_KEEP_ALIVE_SECONDS;
    }
    switch (unit) {
        case 'm':
            return numeric * 60;
        case 'h':
            return numeric * 60 * 60;
        default:
            return numeric;
    }
};

const parseAntiPrompt = (value?: string): string[] | undefined => {
    if (!value) return undefined;
    const prompts = value.split(',').map(s => s.trim()).filter(Boolean);
    return prompts.length > 0 ? prompts : undefined;
};

const parseSamplerOrder = (value?: string): number[] | undefined => {
    if (!value) return undefined;
    const samplers = value
        .split(',')
        .map(token => parseInt(token.trim(), 10))
        .filter(n => !Number.isNaN(n));
    return samplers.length > 0 ? samplers : undefined;
};

const sanitizeBody = (body: Record<string, any>): Record<string, any> => {
    Object.keys(body).forEach(key => {
        if (body[key] === undefined || Number.isNaN(body[key])) {
            delete body[key];
        }
    });
    return body;
};

const applyRawOverrides = (body: Record<string, any>, rawOverrides?: string): Record<string, any> => {
    if (!rawOverrides || !rawOverrides.trim()) {
        return body;
    }
    try {
        const parsed = JSON.parse(rawOverrides);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return { ...body, ...parsed };
        }
    } catch (error) {
        console.error("Invalid rawJsonOverrides JSON:", error);
    }
    return body;
};

const buildCompletionRequestBody = (config: LocalLlmConfig & Settings, prompt: string): Record<string, any> => {
    const topK = parseOptionalNumber(config.modelTopK ?? config.topK);
    const body: Record<string, any> = {
        model: config.model,
        prompt,
        stream: true,
        temperature: parseOptionalNumber(config.temperature),
        top_p: parseOptionalNumber(config.topP),
        top_k: topK,
        repeat_penalty: parseOptionalNumber(config.repetitionPenalty),
        frequency_penalty: parseOptionalNumber(config.frequencyPenalty),
        presence_penalty: parseOptionalNumber(config.presencePenalty),
        stop: config.stop,
        typical_p: parseOptionalNumber(config.typicalP),
        seed: parseOptionalNumber(config.seed),
        keep_alive: parseKeepAliveSeconds(config.modelKeepAlive),
        penalize_nl: parseOptionalBoolean(config.penalizeNewline),
        repeat_last_n: parseOptionalNumber(config.repeatLastN),
        penalty_dry_run_base: parseOptionalNumber(config.penaltyDryRunBase),
        penalty_dry_run_allowed: parseOptionalBoolean(config.penaltyDryRunAllowed),
        penalty_dry_run_penalty: parseOptionalNumber(config.penaltyDryRunPenalty),
        mirostat: parseOptionalNumber(config.mirostat),
        mirostat_tau: parseOptionalNumber(config.mirostatTau),
        mirostat_eta: parseOptionalNumber(config.mirostatEta),
        grammar: config.grammar || undefined,
        cache_prompt: parseOptionalBoolean(config.cachePrompt),
        dump_prompt: parseOptionalBoolean(config.dumpPrompt),
        perplexity: parseOptionalBoolean(config.perplexity),
    };

    const nPredict = parseOptionalNumber(config.maxOutputTokens);
    if (nPredict && nPredict > 0) {
        body.n_predict = nPredict;
    }

    const antiPrompt = parseAntiPrompt(config.antiPrompt);
    if (antiPrompt) {
        body.anti_prompt = antiPrompt;
    }

    const samplerOrder = parseSamplerOrder(config.samplerOrder);
    if (samplerOrder) {
        body.sampler_order = samplerOrder;
    }

    const logprobs = parseOptionalNumber(config.logprobs);
    if (logprobs && logprobs > 0) {
        body.logprobs = logprobs;
    }

    const slotId = parseOptionalNumber(config.slotId);
    if (slotId !== undefined && slotId >= 0) {
        body.slot_id = slotId;
    }

    if (config.idPrefix) {
        body.id_prefix = config.idPrefix;
    }

    if (config.promptCachePath) {
        body.prompt_cache_path = config.promptCachePath;
    }

    if (config.inputPrefix) {
        body.input_prefix = config.inputPrefix;
    }

    if (config.inputSuffix) {
        body.input_suffix = config.inputSuffix;
    }

    if (config.logitBias && config.logitBias.trim() !== '{}' ) {
        try {
            const parsedBias = JSON.parse(config.logitBias);
            if (parsedBias && typeof parsedBias === 'object' && !Array.isArray(parsedBias)) {
                body.logit_bias = Object.entries(parsedBias).map(([token, weight]) => [Number(token), weight]);
            }
        } catch (error) {
            console.error("Invalid logit_bias JSON:", error);
        }
    }

    return sanitizeBody(body);
};

async function* readCompletionStream(response: Response): AsyncGenerator<string, void, unknown> {
    if (!response.body) {
        throw new Error("Response has no body");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const rawLine of lines) {
            if (!rawLine.startsWith('data: ')) continue;
            const payload = rawLine.slice(6).trim();
            if (!payload) continue;
            if (payload === '[DONE]') {
                return;
            }
            try {
                const parsed = JSON.parse(payload);
                const textChunk = typeof parsed.content === 'string'
                    ? parsed.content
                    : parsed.choices?.[0]?.text;
                if (textChunk) {
                    yield textChunk;
                }
            } catch (error) {
                console.error('Error parsing stream chunk:', error, 'Raw content:', payload);
            }
        }
    }
}

async function* streamViaCompletionEndpoint(config: LocalLlmConfig & Settings): AsyncGenerator<string, void, unknown> {
    const headers = {
        'Content-Type': 'application/json',
        ...parseHeaders(config.customHeaders),
    };
    const baseUrl = getBaseUrl(config.url);
    const endpointUrl = `${baseUrl}/completion`;
    const prompt = buildRawPrompt(
        config.localLlmPromptFormat,
        config.systemInstruction || config.systemPrompt || "You are a helpful assistant.",
        config.messages,
        config.customPromptTemplates?.[config.localLlmPromptFormat],
    );

    let requestBody = buildCompletionRequestBody(config, prompt);
    requestBody = applyRawOverrides(requestBody, config.rawJsonOverrides);

    try {
        const response = await fetch(endpointUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal: config.signal,
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API Error (${response.status}) from ${endpointUrl}: ${errorBody}`);
        }

        yield* readCompletionStream(response);
    } catch (error) {
        console.error(`Error in localLlmService.streamChatResponse calling ${endpointUrl}:`, error);
        throw error;
    }
}

async function* streamViaChatEndpoint(config: LocalLlmConfig & Settings): AsyncGenerator<string, void, unknown> {
    const {
        messages,
        systemInstruction,
        onReasoningChunk,
        signal,
        maxOutputTokens,
        ...restConfig
    } = config;

    const effectiveSystemPrompt = systemInstruction || config.systemPrompt || "You are a helpful assistant.";
    const settingsForChat = { ...config, systemPrompt: effectiveSystemPrompt };
    const apiMessages = messages.map(msg => ({ role: msg.role, content: msg.content }));

    const chunkQueue: (string | null)[] = [];
    let resolveNextChunk: ((value: void) => void) | null = null;
    let error: Error | null = null;

    const onChunk = (chunk: string) => {
        chunkQueue.push(chunk);
        if (resolveNextChunk) {
            resolveNextChunk();
            resolveNextChunk = null;
        }
    };

    const onComplete = () => {
        chunkQueue.push(null);
        if (resolveNextChunk) {
            resolveNextChunk();
            resolveNextChunk = null;
        }
    };

    const onError = (err: Error) => {
        console.error("Error from chat service:", err);
        error = err;
        chunkQueue.push(null);
        if (resolveNextChunk) {
            resolveNextChunk();
            resolveNextChunk = null;
        }
    };

    const chatOptions: Record<string, any> = {
        ...restConfig,
        stream: true,
        onChunk,
        onComplete,
        onError,
        onReasoningChunk,
        signal,
        // Explicitly disable enableThinking for local LLM to avoid conflicts
        enableThinking: false,
    };

    if (typeof maxOutputTokens === 'number') {
        chatOptions.max_tokens = maxOutputTokens > 0 ? maxOutputTokens : -1;
    }

    chatService.sendMessage(
        settingsForChat,
        apiMessages,
        chatOptions,
    ).catch(onError);

    while (true) {
        if (chunkQueue.length > 0) {
            const chunk = chunkQueue.shift()!;
            if (chunk === null) {
                if (error) throw error;
                return;
            }
            yield chunk;
        } else {
            await new Promise<void>(resolve => {
                resolveNextChunk = resolve;
            });
        }
    }
}

export async function* streamChatResponse(
  config: LocalLlmConfig & Settings
): AsyncGenerator<string, void, unknown> {
    // Always use the chat endpoint so the server's chat_template decides formatting.
    yield* streamViaChatEndpoint(config);
}

export async function getCompletion(prompt: string, config: LocalLlmConfig & Settings, signal?: AbortSignal): Promise<string> {
    const stream = streamChatResponse({
        ...config,
        messages: [{ role: Role.USER, content: prompt, id: 'get-completion' }],
        signal,
    });

    let result = '';
    for await (const chunk of stream) {
        result += chunk;
    }
    return result.trim();
}
