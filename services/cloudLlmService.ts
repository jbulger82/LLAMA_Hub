import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";
import { type Message, Role } from "../types";
import { type Settings } from "./settings";

function getAiClient(apiKey: string): GoogleGenAI {
  if (!apiKey) {
    throw new Error("Cloud Provider API Key is not configured.");
  }
  return new GoogleGenAI({ apiKey });
}

function fileToGenerativePart(file: File): Promise<{inlineData: { data: string, mimeType: string }}> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
             if (typeof reader.result !== 'string') {
                return reject(new Error("Failed to read file as base64 string."));
            }
            const base64Data = reader.result.split(',')[1];
            resolve({
                inlineData: {
                    data: base64Data,
                    mimeType: file.type
                }
            });
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}


export interface GeminiModelConfig {
  systemInstruction: string;
  model: string;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  enableThinking?: boolean;
  thinkingBudget?: number;
}

export async function* streamGeminiChatResponse(
  messages: Message[], 
  modelConfig: GeminiModelConfig,
  apiKey: string,
  attachedFile?: File,
): AsyncGenerator<string, void, unknown> {
  if (!apiKey) {
      yield "Error: Cloud Provider API Key not configured. Please see the README for setup instructions or add it in Developer Mode settings.";
      return;
  }
  const ai = getAiClient(apiKey);
  const model = modelConfig?.model || "gemini-2.5-flash";
  
  const contents = await Promise.all(messages.map(async (msg) => {
    const parts = [{ text: msg.content }];
    // Attach file only to the last user message if provided
    if (msg.role === Role.USER && attachedFile && messages[messages.length-1] === msg) {
        const filePart = await fileToGenerativePart(attachedFile);
        return {
            role: 'user',
            parts: [parts[0], filePart] // Text first, then file
        };
    }
    return {
        role: msg.role === Role.USER ? 'user' : 'model',
        parts,
    };
  }));

  try {
    const config: any = {
      systemInstruction: modelConfig.systemInstruction,
      temperature: modelConfig.temperature,
      topP: modelConfig.topP,
      topK: modelConfig.topK,
    };

    if (modelConfig.maxOutputTokens && modelConfig.maxOutputTokens > 0) {
        config.maxOutputTokens = modelConfig.maxOutputTokens;
        // As per guidelines, if maxOutputTokens is set for flash, thinkingBudget should be set too.
        if (model.includes('flash') && modelConfig.enableThinking !== false) {
            config.thinkingConfig = { thinkingBudget: modelConfig.thinkingBudget || 100 };
        }
    }

    if (modelConfig.enableThinking === false) {
        config.thinkingConfig = { thinkingBudget: 0 };
    } else if (modelConfig.enableThinking === true && modelConfig.thinkingBudget !== undefined && modelConfig.thinkingBudget > 0) {
        config.thinkingConfig = { thinkingBudget: modelConfig.thinkingBudget };
    }


    const responseStream = await ai.models.generateContentStream({
      model,
      contents,
      config
    });

    for await (const chunk of responseStream) {
      yield chunk.text;
    }
  } catch (error) {
    console.error("Error in streamGeminiChatResponse:", error);
    yield `I'm sorry, but I'm having trouble connecting to the Gemini service. Please check your API key and network connection. Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function* streamOpenAiCompatibleChatResponse(
    messages: Message[],
    settings: Settings,
    apiKey: string,
    systemInstructionOverride?: string,
    signal?: AbortSignal, // Add signal parameter
): AsyncGenerator<string, void, unknown> {
    if (!apiKey) {
        yield "Error: Cloud Provider API Key not configured in the environment or settings.";
        return;
    }
    // This URL construction is made more flexible. The user should provide the full base URL
    // up to the API version, e.g., "https://api.openai.com/v1".
    const apiUrl = `${settings.cloudApiUrl.replace(/\/+$/, '')}/chat/completions`;
    
    let apiMessages;
    
    // Use the override if provided, otherwise use the default from settings.
    const systemPrompt = systemInstructionOverride || settings.systemPrompt;

    // For the 'dev' provider, some endpoints are stricter and don't support the 'system' role well.
    // Prepending the system prompt to the first user message is a common workaround for compatibility.
    if (settings.aiProvider === 'dev') {
        const userMessages = messages.map(m => ({ role: m.role, content: m.content }));
        
        const firstUserIndex = userMessages.findIndex(m => m.role === 'user');

        if (firstUserIndex !== -1) {
            userMessages[firstUserIndex].content = `${systemPrompt}\n\n---\n\n${userMessages[firstUserIndex].content}`;
            apiMessages = userMessages;
        } else {
            // If there are no user messages for some reason, fall back to the standard format.
            apiMessages = [{ role: "system", content: systemPrompt }, ...userMessages];
        }
    } else {
        apiMessages = [
            { role: "system", content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content }))
        ];
    }

    const body = {
        model: settings.model,
        messages: apiMessages,
        stream: true,
        temperature: settings.temperature,
        top_p: settings.topP,
        max_tokens: settings.maxOutputTokens > 0 ? settings.maxOutputTokens : undefined,
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal, // Pass the signal here
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API Error (${response.status}) from ${apiUrl}: ${errorBody}`);
        }
        
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
                        const textChunk = json.choices[0]?.delta?.content;
                        if (textChunk) {
                            yield textChunk;
                        }
                    } catch (e) {
                        console.error('Error parsing stream chunk:', e, 'Raw content:', content);
                    }
                }
            }
        }

    } catch (error) {
        console.error("Error in streamOpenAiCompatibleChatResponse:", error);
        yield `I'm sorry, but I'm having trouble connecting to the configured cloud service. Please check your API key, Base URL, and network connection. Error: ${error instanceof Error ? error.message : String(error)}`;
    }
}


export async function* directQueryStream(
  prompt: string,
  settings: Settings,
  apiKey: string,
  signal?: AbortSignal, // Add signal parameter
): AsyncGenerator<string, void, unknown> {
    if (settings.aiProvider === 'dev' || settings.cloudProvider === 'openai') {
         yield* streamOpenAiCompatibleChatResponse([{ role: Role.USER, content: prompt, id: 'direct-query'}], settings, apiKey, undefined, signal); // Pass signal
    } else { // Default to Gemini
        if (!apiKey) {
          yield "Error: Cloud Provider API Key not configured.";
          return;
        }
        const ai = getAiClient(apiKey);
        const model = settings.model || "gemini-2.5-flash";

        try {
            const config: any = {
              temperature: settings.temperature,
              topP: settings.topP,
              topK: settings.topK,
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
            // Note: The Google GenAI library's generateContentStream does not directly accept an AbortSignal.
            // Cancellation for Gemini streams is not directly supported via AbortSignal at this layer.

            for await (const chunk of responseStream) {
              yield chunk.text;
            }
        } catch (error) {
            console.error("Error in directQueryStream (Gemini):", error);
            yield `I'm sorry, but I'm having trouble connecting to the Gemini service. Please check your API key and network connection. Error: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
}

export async function getCompletion(prompt: string, settings: Settings, apiKey: string, signal?: AbortSignal): Promise<string> {
    const stream = directQueryStream(prompt, settings, apiKey, signal); // Pass signal
    let result = '';
    for await (const chunk of stream) {
        result += chunk;
    }
    return result.trim();
}

export async function getEmbeddings(text: string, model: string, apiKey: string): Promise<number[]> {
  if (!apiKey) {
    throw new Error("Error: Cloud Provider API Key not configured. Please set it to use RAG with the Cloud Provider.");
  }
  const ai = getAiClient(apiKey);
  try {
    const response = await ai.models.embedContent({
      model,
      contents: [{ parts: [{ text }] }],
    });
    
    // Defensive coding: The API might return a successful response that doesn't contain an embedding.
    const embedding = (response as any)?.embedding;
    if (embedding && Array.isArray(embedding.values)) {
      return embedding.values;
    }

    // If we reach here, the response structure is unexpected.
    console.error("Unexpected response structure from Gemini embedContent API:", response);
    const blockReason = (response as any)?.promptFeedback?.blockReason;
    if (blockReason) {
        throw new Error(`Embedding was blocked. Reason: ${blockReason}`);
    }
    
    throw new Error("Could not find embedding values in the Gemini API response. The response format was unexpected.");

  } catch (error) {
    console.error("Error getting Gemini embeddings:", error);
    throw new Error(`Could not get embeddings from Gemini. Please check your API key and ensure the Generative Language API is enabled in your Google Cloud project. Error: ${error instanceof Error ? error.message : 'Unknown Error'}`);
  }
}

export async function getOpenAIEmbeddings(text: string, model: string, apiUrl: string, apiKey: string): Promise<number[]> {
  const fullApiUrl = `${apiUrl.replace(/\/+$/, '')}/embeddings`;
  
  const response = await fetch(fullApiUrl, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
        model: model,
        input: text,
    }),
  });

  if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI Embedding API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.data[0]?.embedding || [];
}

export async function searchWithGrounding(
  query: string,
  settings: Settings,
  apiKey: string,
  signal?: AbortSignal
): Promise<{ answer: string; sources: Array<{ web: { uri: string; title?: string } }> }> {
  if (!apiKey) throw new Error("Cloud Provider API Key is not configured.");

  const ai = getAiClient(apiKey);
  const model = settings.model || "gemini-2.5-flash";

  try {
    const resp: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: query }] }],
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0,
      },
    });

    let answer = (resp.text)?.trim() || "";

    if (!answer) {
        const parts = resp?.candidates?.[0]?.content?.parts || [];
        answer = parts.map((p: any) => p.text || "").join("").trim();
    }

    const sourcesSet = new Map<string, { web: { uri: string; title?: string } }>();

    const addUri = (uri?: string, title?: string) => {
      if (!uri) return;
      if (!sourcesSet.has(uri)) sourcesSet.set(uri, { web: { uri, title } });
    };

    const gm = resp?.candidates?.[0]?.groundingMetadata;

    (gm?.groundingChunks || []).forEach((c: any) =>
      addUri(c?.web?.uri, c?.web?.title)
    );

    const sources = Array.from(sourcesSet.values());

    if (!answer) {
      throw new Error("Gemini grounding returned an empty answer.");
    }

    return { answer, sources };
  } catch (err: any) {
    console.error("Error in searchWithGrounding:", err);
    throw new Error(
      `Google Search grounding failed. ${err?.message ? "Error: " + err.message : ""}`
    );
  }
}