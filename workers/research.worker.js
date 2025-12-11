/**
 * A "fat" Web Worker for orchestrating the Local Deep Research process.
 * To avoid the complexities of module resolution and dependencies in a standard worker environment
 * without a bundler, this file manually includes the code from all necessary service modules.
 * This keeps the heavy lifting off the main UI thread, preventing it from freezing during
 * the multi-step research process which involves multiple LLM calls and web requests.
 */

// --- DEPENDENCY: @google/genai ---
// The worker is created with { type: 'module' }, allowing it to use full URLs for imports.
import { GoogleGenAI } from "https://esm.sh/@google/genai@^1.10.0";

// --- POLYFILL: process.env ---
// Services rely on process.env.API_KEY. We create a polyfill and populate it
// from the initial message sent by the main thread.
const process = {
    env: {
        API_KEY: ''
    }
};

// --- INLINED CODE from types.ts ---
var Role;
(function (Role) {
    Role["USER"] = "user";
    Role["ASSISTANT"] = "assistant";
})(Role || (Role = {}));

// --- INLINED UTILITY FUNCTIONS ---

// from backoff.ts suggestion
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function retry(fn, attempts = 3) {
  let err;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) {
      err = e;
      if (i < attempts - 1) await sleep(300 * 2 ** i + Math.floor(Math.random() * 150));
    }
  }
  throw err;
}

// from urlUtils.ts suggestion
function normalizeUrl(raw) {
  try {
    const u = new URL(raw.trim());
    u.hash = ''; // strip fragments
    const strip = /^(utm_|fbclid$|gclid$|yclid$|mc_)/i;
    [...u.searchParams.keys()].forEach(k => {
      if (strip.test(k)) u.searchParams.delete(k);
    });
    if (!u.pathname || u.pathname === '/') u.pathname = '';
    u.hostname = u.hostname.toLowerCase();
    u.pathname = u.pathname.replace(/\/{2,}/g, '/');
    return u.toString();
  } catch {
    return raw.trim();
  }
}

function dedupeUrls(urls) {
  const seen = new Set();
  const out = [];
  for (const raw of urls) {
    const n = normalizeUrl(raw);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

// Concurrency Pool
async function runWithPool(items, limit, fn) {
  const q = [...items];
  const results = [];
  const workers = Array.from({length: Math.min(limit, q.length)}, async () => {
    while (q.length) {
      const item = q.shift();
      try { 
        const result = await fn(item);
        if (result) results.push(result);
      } catch (e) {
        console.error(`[Worker Pool] Error processing item:`, item, e);
      }
    }
  });
  await Promise.all(workers);
  return results;
}

// from researchLocal.ts
function stripHtmlKeepText(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


// --- INLINED CODE from services/promptBuilder.ts ---
const buildLlama3 = (system, messages) => {
    let prompt = "<|begin_of_text|>";
    if (system) {
        prompt += `<|start_header_id|>system<|end_header_id|>\n\n${system}<|eot_id|>`;
    }
    messages.forEach(msg => {
        prompt += `<|start_header_id|>${msg.role}<|end_header_id|>\n\n${msg.content}<|eot_id|>`;
    });
    prompt += `<|start_header_id|>assistant<|end_header_id|>\n\n`;
    return prompt;
};
const buildChatML = (system, messages) => {
    let prompt = '';
    if (system) {
        prompt += `<|im_start|>system\n${system}<|im_end|>\n`;
    }
    messages.forEach(msg => {
        prompt += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
    });
    prompt += `<|im_start|>assistant`;
    return prompt;
};
const buildGemma = (system, messages) => {
    let prompt = '';
    messages.forEach((msg, index) => {
        let content = msg.content;
        if (index === 0 && system) {
            content = `${system}\n\n${content}`;
        }
        prompt += `<start_of_turn>${msg.role === Role.USER ? 'user' : 'model'}\n${content}<end_of_turn>\n`;
    });
    prompt += `<start_of_turn>model`;
    return prompt;
};
const buildDeepseekCoder = (system, messages) => {
    let prompt = system || `You are an AI programming assistant, utilizing the Deepseek Coder model, developed by Deepseek Company. For inquiries regarding creation and Deepseek Coder, refer to the Deepseek Coder website.`;
    prompt += "\n";
    messages.forEach(msg => {
        prompt += msg.role === Role.USER ? `### Instruction:\n${msg.content}\n` : `### Response:\n${msg.content}\n`;
    });
    prompt += `### Response:\n`;
    return prompt;
};
const buildGptOss = (system, messages) => {
    let prompt = `<|start|>system<|message|>${system}<|end|>`;
    messages.forEach(msg => {
        if (msg.role === Role.USER) {
            prompt += `<|start|>user<|message|>${msg.content}<|end|>`;
        } else if (msg.role === Role.ASSISTANT) {
            prompt += `<|start|>assistant<|channel|>final<|message|>${msg.content}<|end|>`;
        }
    });
    prompt += `<|start|>assistant`;
    return prompt;
};
const formatMessagesForCustomTemplate = (messages) => {
    return messages.map(msg => {
        const roleLabel = msg.role === Role.USER ? 'USER' : 'ASSISTANT';
        return `[${roleLabel} MESSAGE]\n${msg.content}`;
    }).join('\n\n');
};
const renderCustomTemplate = (template, system, messages) => {
    const replacements = {
        system: system || '',
        messages: formatMessagesForCustomTemplate(messages),
        latest_user: [...messages].reverse().find(m => m.role === Role.USER)?.content || '',
    };
    let output = template;
    for (const key of Object.keys(replacements)) {
        const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
        output = output.replace(pattern, replacements[key]);
    }
    return output;
};
const buildRawPrompt = (format, system, messages, customTemplates) => {
    const override = customTemplates && customTemplates[format];
    if (override && override.trim()) {
        return renderCustomTemplate(override, system, messages);
    }
    switch (format) {
        case 'llama3':
            return buildLlama3(system, messages);
        case 'chatml':
            return buildChatML(system, messages);
        case 'gemma':
            return buildGemma(system, messages);
        case 'deepseek-coder':
            return buildDeepseekCoder(system, messages);
        case 'gpt-oss':
            return buildGptOss(system, messages);
        default:
            return '';
    }
};

// --- INLINED CODE from services/localLlmService.ts ---
function getBaseUrl(userUrl) {
    if (!userUrl) return '';
    let urlStr = userUrl.trim().replace(/\/+$/, '');
    const endpoints = ['/v1/chat/completions', '/v1/completions', '/v1/embeddings', '/completion'];
    for (const endpoint of endpoints) {
        if (urlStr.endsWith(endpoint)) {
            return urlStr.substring(0, urlStr.length - endpoint.length);
        }
    }
    return urlStr;
}
function parseKeepAlive(duration) {
    if (!duration) return 300;
    if (duration === 'forever') return -1;
    const unit = duration.slice(-1);
    const value = parseInt(duration.slice(0, -1), 10);
    if (isNaN(value)) return 300;
    switch (unit) {
        case 'm': return value * 60;
        case 'h': return value * 60 * 60;
        default: return 300;
    }
}
function parseHeaders(headersString) {
    if (!headersString) return {};
    try {
        const headers = JSON.parse(headersString);
        if (typeof headers === 'object' && headers !== null && !Array.isArray(headers)) {
            return headers;
        }
        return {};
    } catch (e) {
        console.error("Invalid custom headers JSON:", e);
        return {};
    }
}
async function* handleStream(response, isChatCompletion) {
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
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const content = line.substring(6);
                if (content.trim() === '[DONE]') {
                    return;
                }
                try {
                    const json = JSON.parse(content);
                    let textChunk;
                    if (isChatCompletion) {
                        textChunk = json.choices[0]?.delta?.content;
                    } else {
                        textChunk = json.content;
                    }
                    if (textChunk) {
                        yield textChunk;
                    }
                } catch (e) {
                    console.error('Error parsing stream chunk:', e, 'Raw content:', content);
                }
            }
        }
    }
}
async function* streamChatResponse(config) {
    const headers = {
        'Content-Type': 'application/json',
        ...parseHeaders(config.customHeaders),
    };
    const commonBody = {
        model: config.model,
        stream: true,
        temperature: config.temperature,
        top_p: config.topP,
        top_k: config.topK,
        repeat_penalty: config.repetitionPenalty,
        frequency_penalty: config.frequencyPenalty,
        presence_penalty: config.presencePenalty,
        stop: config.stop,
        typical_p: config.typicalP,
        seed: config.seed,
        keep_alive: parseKeepAlive(config.keepAlive),
        penalize_nl: config.penalizeNewline,
        repeat_last_n: config.repeatLastN,
        penalty_dry_run_base: config.penaltyDryRunBase,
        penalty_dry_run_allowed: config.penaltyDryRunAllowed,
        penalty_dry_run_penalty: config.penaltyDryRunPenalty,
        mirostat: config.mirostat,
        mirostat_tau: config.mirostatTau,
        mirostat_eta: config.mirostatEta,
        grammar: config.grammar || undefined,
    };
    if (config.antiPrompt) commonBody.anti_prompt = config.antiPrompt.split(',').map(s => s.trim()).filter(Boolean);
    if (config.cachePrompt) commonBody.cache_prompt = config.cachePrompt;
    if (config.logprobs && config.logprobs > 0) commonBody.logprobs = config.logprobs;
    if (config.perplexity) commonBody.perplexity = config.perplexity;
    if (config.dumpPrompt) commonBody.dump_prompt = config.dumpPrompt;
    if (config.samplerOrder) {
        const samplerOrderArray = config.samplerOrder.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        if (samplerOrderArray.length > 0) commonBody.sampler_order = samplerOrderArray;
    }
    if (config.slotId !== undefined && config.slotId >= 0) commonBody.slot_id = config.slotId;
    if (config.idPrefix) commonBody.id_prefix = config.idPrefix;
    if (config.promptCachePath) commonBody.prompt_cache_path = config.promptCachePath;
    try {
        if (config.logitBias && config.logitBias.trim() !== '{}') {
            const parsedLogitBias = JSON.parse(config.logitBias);
            if (Object.keys(parsedLogitBias).length > 0) {
                commonBody.logit_bias = Object.entries(parsedLogitBias).map(([k, v]) => [parseInt(k, 10), v]);
            }
        }
    } catch (e) { console.error("Invalid logit_bias JSON:", e); }
    let endpointUrl;
    let requestBody;
    let isChatCompletion;
    const baseUrl = getBaseUrl(config.url);
    if (config.localLlmPromptFormat === 'openai-gemma2' || config.localLlmPromptFormat === 'jinja') {
        isChatCompletion = true;
        endpointUrl = `${baseUrl}/v1/chat/completions`;
        const apiMessages = [
            { role: "system", content: config.systemInstruction || "You are a helpful assistant." },
            ...config.messages.map(m => ({ role: m.role, content: m.content }))
        ];
        requestBody = {
            ...commonBody,
            messages: apiMessages,
            max_tokens: config.maxOutputTokens,
        };
    } else {
        isChatCompletion = false;
        endpointUrl = `${baseUrl}/completion`;
        const prompt = buildRawPrompt(
            config.localLlmPromptFormat,
            config.systemInstruction || "You are a helpful assistant.",
            config.messages,
            config.customPromptTemplates || {}
        );
        requestBody = {
            ...commonBody,
            prompt,
            n_predict: config.maxOutputTokens,
        };
        if (config.inputPrefix) requestBody.input_prefix = config.inputPrefix;
        if (config.inputSuffix) requestBody.input_suffix = config.inputSuffix;
    }
    try {
        if (config.rawJsonOverrides && config.rawJsonOverrides.trim() !== '{}') {
            const overrides = JSON.parse(config.rawJsonOverrides);
            requestBody = { ...requestBody, ...overrides };
        }
    } catch (e) { console.error("Invalid rawJsonOverrides JSON:", e); }
    try {
        const response = await fetch(endpointUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API Error (${response.status}) from ${endpointUrl}: ${errorBody}`);
        }
        yield* handleStream(response, isChatCompletion);
    } catch (error) {
        console.error(`Error in localLlmService.streamChatResponse calling ${endpointUrl}:`, error);
        throw error;
    }
}
async function local_getCompletion(prompt, config) {
    const stream = streamChatResponse({
        ...config,
        messages: [{ role: Role.USER, content: prompt, id: 'get-completion' }],
    });
    let result = '';
    for await (const chunk of stream) {
        result += chunk;
    }
    return result.trim();
}

// --- INLINED CODE from services/cloudLlmService.ts ---
function getAiClient(apiKey) {
    if (!apiKey) {
        throw new Error("Cloud Provider API Key is not configured.");
    }
    return new GoogleGenAI({ apiKey });
}
async function* directQueryStream(prompt, settings, apiKey) {
    if (settings.aiProvider === 'dev' || settings.cloudProvider === 'openai') {
        yield* streamOpenAiCompatibleChatResponse([{ role: Role.USER, content: prompt, id: 'direct-query' }], settings, apiKey);
    } else {
        if (!apiKey) {
            yield "Error: Cloud Provider API Key not configured.";
            return;
        }
        const ai = getAiClient(apiKey);
        const model = settings.model || "gemini-2.5-flash";
        try {
            const config = {
                temperature: settings.temperature,
                topP: settings.topP,
                topK: settings.modelTopK,
            };
            if (settings.maxOutputTokens && settings.maxOutputTokens > 0) {
                config.maxOutputTokens = settings.maxOutputTokens;
            }
            if (settings.enableThinking === false) {
                config.thinkingConfig = { thinkingBudget: 0 };
            } else if (settings.enableThinking === true && settings.thinkingBudget !== undefined && settings.thinkingBudget > 0) {
                config.thinkingConfig = { thinkingBudget: settings.thinkingBudget };
            }
            const responseStream = await ai.models.generateContentStream({
                model,
                contents: prompt,
                config
            });
            for await (const chunk of responseStream) {
                yield chunk.text;
            }
        } catch (error) {
            console.error("Error in directQueryStream (Gemini):", error);
            yield `I'm sorry, but I'm having trouble connecting to the Gemini service. Error: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
}
async function cloud_getCompletion(prompt, settings, apiKey) {
    const stream = directQueryStream(prompt, settings, apiKey);
    let result = '';
    for await (const chunk of stream) {
        result += chunk;
    }
    return result.trim();
}

// --- INLINED CODE from services/webAccessService.ts ---
async function proxiedFetch(url, userAgent, proxyUrlBase, asBlob = false) {
    if (!proxyUrlBase) throw new Error("Francine proxy not configured.");
    const response = await fetchWithTimeout(`${proxyUrlBase}/proxy/curl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, userAgent, asBlob })
    }, 20000);
    if (!response.ok) {
        const msg = await response.text().catch(() => '');
        throw new Error(`Proxy ${response.status}: ${msg || response.statusText}`);
    }
    return asBlob ? await response.blob() : await response.text();
}
function parseDuckResults(html) {
  const out = [];
  // fast path (current)
  const re = /<a class="result__a" href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?result__snippet[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) && out.length < 10) {
    try {
        const url = new URL(m[1], "https://duckduckgo.com").href;
        out.push({ title: m[2].replace(/<[^>]+>/g,''), url, snippet: m[3].replace(/<[^>]+>/g,'') });
    } catch {}
  }
  if (out.length) return out;

  // fallback: any “uddg=” style links
  const re2 = /href="\/l\/\?kh=-1&uddg=([^"&]+)[^"]*".*?>([\s\S]*?)<\/a>/g;
  while ((m = re2.exec(html)) && out.length < 10) {
    try {
        const url = decodeURIComponent(m[1]);
        out.push({ title: m[2].replace(/<[^>]+>/g,''), url });
    } catch {}
  }
  return out;
}
const parseGoogleSearchResults = (data) => {
    if (!data.items || data.items.length === 0) {
        return [];
    }
    return data.items.slice(0, 10).map((item) => ({
        title: item.title || 'No title',
        url: item.link || '#',
        snippet: item.snippet || 'No snippet',
    }));
};
const web_search = async (query, settings) => {
    let searchUrl = '';
    const encodedQuery = encodeURIComponent(query);
    switch (settings.searchEngine) {
        case 'google':
            const googleDevApiKey = (settings.developerMode && settings.dev_googleDeveloperApiKey) ? settings.dev_googleDeveloperApiKey : (process.env.GOOGLE_API_DEVELOPER_KEY || '');
            if (!googleDevApiKey || !settings.googleSearchCxId) throw new Error('Google Search is not configured.');
            searchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleDevApiKey}&cx=${settings.googleSearchCxId}&q=${encodedQuery}`;
            try {
                const response = await fetch(searchUrl);
                const data = await response.json();
                if (!response.ok) throw new Error(`Error from Google Search API: ${data.error?.message || 'Unknown error'}`);
                return parseGoogleSearchResults(data);
            } catch (error) { throw new Error(`Error performing search with Google: ${error.message}`); }
        case 'duckduckgo':
        default: {
            const primary = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;
            try {
                const resultsHtml = await proxiedFetch(primary, settings.curlUserAgent, settings.proxyUrl);
                return parseDuckResults(resultsHtml);
            } catch (error) {
                throw new Error(`Error performing search with DuckDuckGo: ${error.message}`);
            }
        }
    }
};

// --- INLINED CODE from services/systemService.ts ---
async function fetchFromProxy(proxyUrl, endpoint, options) {
    try {
        const response = await fetch(`${proxyUrl}/proxy${endpoint}`, options);
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || `An unknown error occurred at the proxy server.`);
        }
        return result;
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error("Failed to connect to the Francine proxy server. Is it running?");
        }
        throw error;
    }
}
async function appendToResearchFile(filePath, content, proxyUrl) {
    await fetchFromProxy(proxyUrl, '/research/append', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, content }),
    });
}
async function readResearchFile(filePath, proxyUrl) {
    return fetchFromProxy(proxyUrl, '/research/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
    });
}

// --- WORKER-SPECIFIC RESEARCH LOGIC ---
const getLlmCompletion = (settings) => {
    return async (prompt, useCloud = false) => {
        const apiKey = (settings.developerMode && settings.dev_geminiApiKey) ? settings.dev_geminiApiKey : (process.env.API_KEY || '');
        if (useCloud) {
            if (!apiKey) throw new Error("Cloud API Key is required but not configured.");
            return cloud_getCompletion(prompt, settings, apiKey);
        }
        if (settings.aiProvider === 'localLlm') {
            return local_getCompletion(prompt, { ...settings, url: settings.localLlmUrl, model: settings.localLlmModelName, localLlmPromptFormat: settings.localLlmPromptFormat, systemInstruction: "You are a helpful research assistant.", messages: [] });
        } else {
            return cloud_getCompletion(prompt, settings, apiKey);
        }
    };
};
async function generateSearchQueries(topic, llm) {
    const prompt = `You are an expert researcher. Based on the following topic, generate 5 diverse and effective web search queries to gather comprehensive information. Output ONLY the queries, one per line.\n\nTopic: "${topic}"`;
    const result = await llm(prompt);
    return result.split('\n').map(q => q.trim()).filter(Boolean);
}

async function factCheckSummary(summary, topic, settings, llm) {
    const claimsPrompt = `Extract the top 5 most important and verifiable factual claims from the following summary on "${topic}". Output ONLY the claims, one per line.\n\n--- SUMMARY ---\n${summary}`;
    const claims = (await llm(claimsPrompt, true)).split('\n').map(c => c.trim()).filter(Boolean);
    let report = "--- FACT-CHECKING REPORT ---\n\n";
    for (const claim of claims) {
        const searchResults = await web_search(`fact check: ${claim}`, settings);
        const searchSnippets = searchResults.map(r => `Title: ${r.title}\nSnippet: ${r.snippet}`).join('\n\n');
        const verificationPrompt = `Based on the following search results, verify the claim: "${claim}". State whether the claim is "Confirmed," "Plausible," "Unverified," or "Inaccurate," and provide a brief explanation.\n\n--- SEARCH RESULTS ---\n${searchSnippets}`;
        const verification = await llm(verificationPrompt, true);
        report += `Claim: ${claim}\nVerification:\n${verification}\n\n`;
    }
    return report;
}

async function runNextResearchStep(job, settings) {
    const llm = getLlmCompletion(settings);
    const lastStep = job.completedSteps[job.completedSteps.length - 1] || null;
    const perDocChars = 8000; 

    try {
        if (!lastStep) {
            await appendToResearchFile(job.filePath, `Agent: Researcher\nTask: Generating search queries...\n\n`, settings.proxyUrl);
            const queries = await generateSearchQueries(job.topic, llm);
            await appendToResearchFile(job.filePath, `Generated Queries:\n- ${queries.join('\n- ')}`, settings.proxyUrl);
            return { ...job, currentAgent: 'Web', statusMessage: 'Searching the web and fetching pages...', completedSteps: ['generated-queries'] };
        }
        
        if (lastStep === 'generated-queries') {
            const researchFileContent = await readResearchFile(job.filePath, settings.proxyUrl);
            const queries = researchFileContent.content.match(/Generated Queries:\n- (.*)/s)?.[1].split('\n- ').map(q => q.trim()).filter(Boolean) || [];
            
            let allSearchResults = [];
            for (const query of queries) {
                const results = await web_search(query, settings);
                allSearchResults.push(...results);
            }
            const urls = dedupeUrls(allSearchResults.map(r => r.url));
            await appendToResearchFile(job.filePath, `Identified ${urls.length} unique URLs to fetch.`, settings.proxyUrl);

            const pages = await runWithPool(urls, 3, async (url) => {
                 const html = await proxiedFetch(url, settings.curlUserAgent, settings.proxyUrl);
                 const text = stripHtmlKeepText(html).slice(0, perDocChars);
                 const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g,' ').trim() || url;
                 if (text.length > 300) return { url, title, text };
                 return null;
            });
            
            const validPages = pages.filter(Boolean);
            await appendToResearchFile(job.filePath, `--- FETCHED PAGES ---\n${JSON.stringify(validPages.map(p => ({url: p.url, title: p.title, text_length: p.text.length})), null, 2)}`, settings.proxyUrl);
            // Store full content for next step
            await appendToResearchFile(job.filePath, `\n\n--- FULL PAGE CONTENT ---\n${JSON.stringify(validPages, null, 2)}`, settings.proxyUrl);

            return { ...job, currentAgent: 'Summarizer', statusMessage: `Summarizing content from ${validPages.length} pages...`, completedSteps: [...job.completedSteps, 'fetched-pages'] };
        }

        if (lastStep === 'fetched-pages') {
            const researchFileContent = await readResearchFile(job.filePath, settings.proxyUrl);
            const pagesJson = researchFileContent.content.match(/--- FULL PAGE CONTENT ---\n([\s\S]*)/)?.[1];
            if (!pagesJson) throw new Error("Could not find fetched page content in research file.");
            const pages = JSON.parse(pagesJson);

            const summaries = await runWithPool(pages, 2, async (p) => {
                const prompt = `Summarize the key facts from this page relevant to the query: ${job.topic}.\nReturn: bullet list of facts. No opinions. Keep numbers/dates. ≤ 120 words.\nText:\n${p.text}`;
                const summary = await llm(prompt);
                return { url: p.url, title: p.title, summary: summary.trim() };
            });

            await appendToResearchFile(job.filePath, `\n\n--- PAGE SUMMARIES ---\n${JSON.stringify(summaries, null, 2)}`, settings.proxyUrl);
            return { ...job, currentAgent: 'Synthesizer', statusMessage: 'Synthesizing final report from summaries...', completedSteps: [...job.completedSteps, 'summarized-pages'] };
        }

        if (lastStep === 'summarized-pages') {
            const researchFileContent = await readResearchFile(job.filePath, settings.proxyUrl);
            const summariesJson = researchFileContent.content.match(/--- PAGE SUMMARIES ---\n([\s\S]*)/)?.[1];
             if (!summariesJson) throw new Error("Could not find page summaries in research file.");
            const summaries = JSON.parse(summariesJson);

            const joined = summaries.map(s => `### ${s.title}\nURL: ${s.url}\n${s.summary}\n`).join('\n');
            const finalPrompt = `User query: ${job.topic}\nYou have multiple page digests below. Write a concise, factual answer. Prefer the most recent or authoritative sources if claims conflict. Include caveats for uncertainty.\n\nDigests:\n${joined}`;
            const answer = await llm(finalPrompt);

            await appendToResearchFile(job.filePath, `\n\n--- FINAL SYNTHESIS ---\n${answer}`, settings.proxyUrl);
            return { ...job, status: 'confirm_factcheck', currentAgent: 'FactChecker', statusMessage: 'Awaiting user confirmation for fact-checking.', completedSteps: [...job.completedSteps, 'synthesized'] };
        }

        if (lastStep === 'factcheck-confirmed') {
             await appendToResearchFile(job.filePath, `Agent: FactChecker\nTask: Verifying claims using cloud provider...\n\n`, settings.proxyUrl);
             const researchFileContent = await readResearchFile(job.filePath, settings.proxyUrl);
             const summary = researchFileContent.content.match(/--- FINAL SYNTHESIS ---\n([\s\S]*)/)?.[1] || '';
             const factCheckReport = await factCheckSummary(summary, job.topic, settings, llm);
             await appendToResearchFile(job.filePath, factCheckReport, settings.proxyUrl);
             return { ...job, status: 'complete', currentAgent: null, statusMessage: 'Research complete! Report saved to your Desktop.', completedSteps: [...job.completedSteps, 'fact-checked'] };
        }

    } catch (error) {
        await appendToResearchFile(job.filePath, `--- AGENT ERROR ---\nAgent: ${job.currentAgent}\nError: ${error.message}\n`, settings.proxyUrl);
        throw error; // Re-throw to be caught by the orchestrator
    }

    // Default return if no case matches (should not happen in a valid flow)
    return { ...job, status: 'complete', statusMessage: 'Research process finished unexpectedly.' };
}

// --- WORKER MESSAGE HANDLER ---
self.onmessage = async (event) => {
    const { job, settings, apiKey } = event.data;

    if (!job || !settings) {
        self.postMessage({ type: 'error', job: { ...job, status: 'error', statusMessage: 'Worker received invalid initial data.' } });
        return;
    }

    process.env.API_KEY = apiKey;
    
    let currentJob = job;

    try {
        while (currentJob.status === 'running') {
            const updatedJob = await runNextResearchStep(currentJob, settings);
            currentJob = updatedJob;

            self.postMessage({ type: 'progress', job: currentJob });

            if (currentJob.status !== 'running') {
                break;
            }
        }
        self.postMessage({ type: 'final', job: currentJob });

    } catch (error) {
        console.error("Error during research job in worker:", error);
        const errorJob = {
            ...currentJob,
            status: 'error',
            statusMessage: `An error occurred in the research worker: ${error.message}`
        };
        self.postMessage({ type: 'error', job: errorJob });
    }
};
