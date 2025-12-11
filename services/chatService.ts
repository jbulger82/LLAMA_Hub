// services/chatService.ts
// Adapted from Fix/chat.ts

import type { Settings } from "./settings";
import { slotsService } from "./slotsService";
import type {
  ApiChatCompletionRequest,
  ApiChatCompletionResponse,
  ApiChatCompletionStreamChunk,
  ApiChatCompletionToolCall,
  ApiChatCompletionToolCallDelta,
  ApiChatMessageData,
  ApiChatMessageContentPart,
  ApiLlamaCppServerProps,
  ApiErrorResponse,
} from "../types";
import type {
  Message,
  Role,
  DatabaseMessage,
  DatabaseMessageExtra,
  DatabaseMessageExtraAudioFile,
  DatabaseMessageExtraImageFile,
  DatabaseMessageExtraLegacyContext,
  DatabaseMessageExtraPdfFile,
  DatabaseMessageExtraTextFile,
} from "../types";
import type { ChatMessagePromptProgress, ChatMessageTimings } from "../types";

/**
 * ChatService - Low-level API communication layer for llama.cpp server interactions
 */
export class ChatService {
  private abortControllers: Map<string, AbortController> = new Map();

  async sendMessage(
    settings: Settings,

    messages:
      | ApiChatMessageData[]
      | (DatabaseMessage & { extra?: DatabaseMessageExtra[] })[],

    options: any = {}, // Simplified for now

    conversationId?: string,
  ): Promise<string | void> {
    const {
      stream,

      onChunk,

      onComplete,

      onError,

      onReasoningChunk,

      onToolCallChunk,

      onModel,

      onFirstValidChunk,

      signal, // <<< Added signal

      // Generation parameters

      temperature,

      max_tokens,

      // Sampling parameters

      dynatemp_range,

      dynatemp_exponent,

      top_k,

      top_p,

      min_p,

      xtc_probability,

      xtc_threshold,

      typ_p,

      // Penalty parameters

      repeat_last_n,

      repeat_penalty,

      presence_penalty,

      frequency_penalty,

      dry_multiplier,

      dry_base,

      dry_allowed_length,

      dry_penalty_last_n,

      // Other parameters

      samplers,

      custom,

      timings_per_token,
    } = options;

    const currentConfig = settings;

    const requestId = conversationId || "default";

    const normalizedMessages: ApiChatMessageData[] = messages

      .map((msg) => {
        if ("id" in msg && "convId" in msg && "timestamp" in msg) {
          const dbMsg = msg as DatabaseMessage & {
            extra?: DatabaseMessageExtra[];
          };

          return ChatService.convertMessageToChatServiceData(dbMsg);
        } else {
          return msg as ApiChatMessageData;
        }
      })

      .filter((msg) => {
        if (msg.role === "system") {
          const content = typeof msg.content === "string" ? msg.content : "";

          return content.trim().length > 0;
        }

        return true;
      });

    const processedMessages = this.injectSystemMessage(
      currentConfig,
      normalizedMessages,
    );

    const requestBody: ApiChatCompletionRequest = {
      messages: processedMessages.map((msg: ApiChatMessageData) => ({
        role: msg.role,

        content: msg.content,
      })),

      stream,
    };

    const modelSelectorEnabled = false; // Simplified

    const activeModel = settings.localLlmModelName;

    if (activeModel) {
      requestBody.model = activeModel;
    }

    // requestBody.reasoning_format = currentConfig.disableReasoningFormat ? 'none' : 'auto';

    if (temperature !== undefined) requestBody.temperature = temperature;

    if (max_tokens !== undefined) {
      requestBody.max_tokens =
        max_tokens !== null && max_tokens !== 0 ? max_tokens : -1;
    }

    if (dynatemp_range !== undefined)
      requestBody.dynatemp_range = dynatemp_range;

    if (dynatemp_exponent !== undefined)
      requestBody.dynatemp_exponent = dynatemp_exponent;

    if (top_k !== undefined) requestBody.top_k = top_k;

    if (top_p !== undefined) requestBody.top_p = top_p;

    if (min_p !== undefined) requestBody.min_p = min_p;

    if (xtc_probability !== undefined)
      requestBody.xtc_probability = xtc_probability;

    if (xtc_threshold !== undefined) requestBody.xtc_threshold = xtc_threshold;

    if (typ_p !== undefined) requestBody.typ_p = typ_p;

    if (repeat_last_n !== undefined) requestBody.repeat_last_n = repeat_last_n;

    if (repeat_penalty !== undefined)
      requestBody.repeat_penalty = repeat_penalty;

    if (presence_penalty !== undefined)
      requestBody.presence_penalty = presence_penalty;

    if (frequency_penalty !== undefined)
      requestBody.frequency_penalty = frequency_penalty;

    if (dry_multiplier !== undefined)
      requestBody.dry_multiplier = dry_multiplier;

    if (dry_base !== undefined) requestBody.dry_base = dry_base;

    if (dry_allowed_length !== undefined)
      requestBody.dry_allowed_length = dry_allowed_length;

    if (dry_penalty_last_n !== undefined)
      requestBody.dry_penalty_last_n = dry_penalty_last_n;

    if (samplers !== undefined) {
      requestBody.samplers =
        typeof samplers === "string"
          ? samplers.split(";").filter((s: string) => s.trim())
          : samplers;
    }

    if (timings_per_token !== undefined)
      requestBody.timings_per_token = timings_per_token;

    if (custom) {
      try {
        const customParams =
          typeof custom === "string" ? JSON.parse(custom) : custom;

        Object.assign(requestBody, customParams);
      } catch (error) {
        console.warn("Failed to parse custom parameters:", error);
      }
    }

    try {
      const apiKey = ""; // Not used in this app in the same way

      const response = await fetch(
        `${settings.localLlmUrl}/v1/chat/completions`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",

            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },

          body: JSON.stringify(requestBody),

          signal: signal, // <<< Use the passed signal
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);

        if (onError) {
          onError(error);
        }

        throw error;
      }

      if (stream) {
        await this.handleStreamResponse(
          settings,

          response,

          onChunk,

          onComplete,

          onError,

          onReasoningChunk,

          onToolCallChunk,

          onModel,

          onFirstValidChunk,

          conversationId,

          signal, // <<< Pass signal to stream handler
        );

        return;
      } else {
        return this.handleNonStreamResponse(
          response,

          onComplete,

          onError,

          onToolCallChunk,

          onModel,
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Chat completion request was aborted");
        if (onError) {
            onError(error);
        }
        return;
      }

      let userFriendlyError: Error;

      if (error instanceof Error) {
        if (error.name === "TypeError" && error.message.includes("fetch")) {
          userFriendlyError = new Error(
            "Unable to connect to server - please check if the server is running",
          );

          userFriendlyError.name = "NetworkError";
        } else if (error.message.includes("ECONNREFUSED")) {
          userFriendlyError = new Error(
            "Connection refused - server may be offline",
          );

          userFriendlyError.name = "NetworkError";
        } else if (error.message.includes("ETIMEDOUT")) {
          userFriendlyError = new Error(
            "Request timed out - the server took too long to respond",
          );

          userFriendlyError.name = "TimeoutError";
        } else {
          userFriendlyError = error;
        }
      } else {
        userFriendlyError = new Error(
          "Unknown error occurred while sending message",
        );
      }

      console.error("Error in sendMessage:", error);

      if (onError) {
        onError(userFriendlyError);
      }

      throw userFriendlyError;
    }
  }

  private async handleStreamResponse(
    settings: Settings,

    response: Response,

    onChunk?: (chunk: string) => void,

    onComplete?: (
      response: string,

      reasoningContent?: string,

      timings?: ChatMessageTimings,

      toolCalls?: string,
    ) => void,

    onError?: (error: Error) => void,

    onReasoningChunk?: (chunk: string) => void,

    onToolCallChunk?: (chunk: string) => void,

    onModel?: (model: string) => void,

    onFirstValidChunk?: () => void,

    conversationId?: string,

    abortSignal?: AbortSignal,
  ): Promise<void> {
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();

    let aggregatedContent = "";

    let fullReasoningContent = "";

    let aggregatedToolCalls: ApiChatCompletionToolCall[] = [];

    let hasReceivedData = false;

    let lastTimings: ChatMessageTimings | undefined;

    let streamFinished = false;

    let modelEmitted = false;

    let firstValidChunkEmitted = false;

    let toolCallIndexOffset = 0;

    let hasOpenToolCallBatch = false;
    let unfinishedChunk = ''; // Buffer for incomplete JSON

    const finalizeOpenToolCallBatch = () => {
      if (!hasOpenToolCallBatch) {
        return;
      }

      toolCallIndexOffset = aggregatedToolCalls.length;

      hasOpenToolCallBatch = false;
    };

    const processToolCallDelta = (
      toolCalls?: ApiChatCompletionToolCallDelta[],
    ) => {
      if (!toolCalls || toolCalls.length === 0) {
        return;
      }

      aggregatedToolCalls = this.mergeToolCallDeltas(
        aggregatedToolCalls,

        toolCalls,

        toolCallIndexOffset,
      );

      if (aggregatedToolCalls.length === 0) {
        return;
      }

      hasOpenToolCallBatch = true;

      const serializedToolCalls = JSON.stringify(aggregatedToolCalls);

      if (!serializedToolCalls) {
        return;
      }

      hasReceivedData = true;

      if (!abortSignal?.aborted) {
        onToolCallChunk?.(serializedToolCalls);
      }
    };

    try {
      let chunk = "";

      while (true) {
        if (abortSignal?.aborted) break;

        const { done, value } = await reader.read();

        if (done) break;

        if (abortSignal?.aborted) break;

        chunk += decoder.decode(value, { stream: true });

        const lines = chunk.split("\n");

        chunk = lines.pop() || "";

        for (const line of lines) {
          if (abortSignal?.aborted) break;

          if (line.startsWith("data: ")) {
                        const data = line.slice(6);
            
                        if (data === "[DONE]") {
                          streamFinished = true;
                          continue;
                        }
            
                        unfinishedChunk += data;
            
                        try {
                          // Attempt to parse the buffered data
                          const parsed: ApiChatCompletionStreamChunk = JSON.parse(unfinishedChunk);
                          
                          // If successful, we have a complete JSON object.
                          // Reset the buffer for the next object.
                          unfinishedChunk = '';
            
                          if (
                            !firstValidChunkEmitted &&
                            parsed.object === "chat.completion.chunk"
                          ) {
                            firstValidChunkEmitted = true;
            
                            if (!abortSignal?.aborted) {
                              onFirstValidChunk?.();
                            }
                          }
            
                          const content = parsed.choices[0]?.delta?.content;
            
                          const reasoningContent =
                            parsed.choices[0]?.delta?.reasoning_content;
            
                          const toolCalls = parsed.choices[0]?.delta?.tool_calls;
            
                          const timings = parsed.timings;
            
                          const promptProgress = parsed.prompt_progress;
            
                          const chunkModel = this.extractModelName(parsed);
            
                          if (chunkModel && !modelEmitted) {
                            modelEmitted = true;
            
                            onModel?.(chunkModel);
                          }
            
                          if (timings || promptProgress) {
                            this.updateProcessingState(
                              settings,
                              timings,
                              promptProgress,
                              conversationId,
                            );
            
                            if (timings) {
                              lastTimings = timings;
                            }
                          }
            
                          if (content) {
                            finalizeOpenToolCallBatch();
            
                            hasReceivedData = true;
            
                            aggregatedContent += content;
            
                            if (!abortSignal?.aborted) {
                              onChunk?.(content);
                            }
                          }
            
                          if (reasoningContent) {
                            finalizeOpenToolCallBatch();
            
                            hasReceivedData = true;
            
                            fullReasoningContent += reasoningContent;
            
                            if (!abortSignal?.aborted) {
                              onReasoningChunk?.(reasoningContent);
                            }
                          }
            
                          processToolCallDelta(toolCalls);
                        } catch (e) {
                          // Expected for incomplete JSON; keep buffering unless it grows too large.
                          if (unfinishedChunk.length > 2 * 1024 * 1024) { // 2MB safety limit
                            const err = new Error("Stream buffer exceeded safety limit; possible malformed or extremely large JSON payload.");
                            console.error(err.message);
                            onError?.(err);
                            throw err;
                          }
                        }
          }
        }

        if (abortSignal?.aborted) break;
      }

      if (abortSignal?.aborted) return;

      if (streamFinished) {
        finalizeOpenToolCallBatch();

        if (
          !hasReceivedData &&
          aggregatedContent.length === 0 &&
          aggregatedToolCalls.length === 0
        ) {
          const noResponseError = new Error(
            "No response received from server. Please try again.",
          );

          throw noResponseError;
        }

        const finalToolCalls =
          aggregatedToolCalls.length > 0
            ? JSON.stringify(aggregatedToolCalls)
            : undefined;

        onComplete?.(
          aggregatedContent,

          fullReasoningContent || undefined,

          lastTimings,

          finalToolCalls,
        );
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Stream error");

      onError?.(err);

      throw err;
    } finally {
      reader.releaseLock();
    }
  }

  private mergeToolCallDeltas(
    existing: ApiChatCompletionToolCall[],

    deltas: ApiChatCompletionToolCallDelta[],

    indexOffset = 0,
  ): ApiChatCompletionToolCall[] {
    const result = existing.map((call) => ({
      ...call,

      function: call.function ? { ...call.function } : undefined,
    }));

    for (const delta of deltas) {
      const index =
        typeof delta.index === "number" && delta.index >= 0
          ? delta.index + indexOffset
          : result.length;

      while (result.length <= index) {
        result.push({ function: undefined });
      }

      const target = result[index]!;

      if (delta.id) {
        target.id = delta.id;
      }

      if (delta.type) {
        target.type = delta.type;
      }

      if (delta.function) {
        const fn = target.function ? { ...target.function } : {};

        if (delta.function.name) {
          fn.name = delta.function.name;
        }

        if (delta.function.arguments) {
          fn.arguments = (fn.arguments ?? "") + delta.function.arguments;
        }

        target.function = fn;
      }
    }

    return result;
  }

  private async handleNonStreamResponse(
    response: Response,

    onComplete?: (
      response: string,

      reasoningContent?: string,

      timings?: ChatMessageTimings,

      toolCalls?: string,
    ) => void,

    onError?: (error: Error) => void,

    onToolCallChunk?: (chunk: string) => void,

    onModel?: (model: string) => void,
  ): Promise<string> {
    try {
      const responseText = await response.text();

      if (!responseText.trim()) {
        const noResponseError = new Error(
          "No response received from server. Please try again.",
        );

        throw noResponseError;
      }

      const data: ApiChatCompletionResponse = JSON.parse(responseText);

      const responseModel = this.extractModelName(data);

      if (responseModel) {
        onModel?.(responseModel);
      }

      const content = data.choices[0]?.message?.content || "";

      const reasoningContent = data.choices[0]?.message?.reasoning_content;

      const toolCalls = data.choices[0]?.message?.tool_calls;

      if (reasoningContent) {
        console.log("Full reasoning content:", reasoningContent);
      }

      let serializedToolCalls: string | undefined;

      if (toolCalls && toolCalls.length > 0) {
        const mergedToolCalls = this.mergeToolCallDeltas([], toolCalls);

        if (mergedToolCalls.length > 0) {
          serializedToolCalls = JSON.stringify(mergedToolCalls);

          if (serializedToolCalls) {
            onToolCallChunk?.(serializedToolCalls);
          }
        }
      }

      if (!content.trim() && !serializedToolCalls) {
        const noResponseError = new Error(
          "No response received from server. Please try again.",
        );

        throw noResponseError;
      }

      onComplete?.(content, reasoningContent, undefined, serializedToolCalls);

      return content;
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Parse error");

      onError?.(err);

      throw err;
    }
  }

  static convertMessageToChatServiceData(
    message: DatabaseMessage & { extra?: DatabaseMessageExtra[] },
  ): ApiChatMessageData {
    if (!message.extra || message.extra.length === 0) {
      return {
        role: message.role as "user" | "assistant" | "system",

        content: message.content,
      };
    }

    const contentParts: ApiChatMessageContentPart[] = [];

    if (message.content) {
      contentParts.push({
        type: "text",

        text: message.content,
      });
    }

    const imageFiles = message.extra.filter(
      (extra: DatabaseMessageExtra): extra is DatabaseMessageExtraImageFile =>
        extra.type === "imageFile",
    );

    for (const image of imageFiles) {
      contentParts.push({
        type: "image_url",

        image_url: { url: image.base64Url },
      });
    }

    const textFiles = message.extra.filter(
      (extra: DatabaseMessageExtra): extra is DatabaseMessageExtraTextFile =>
        extra.type === "textFile",
    );

    for (const textFile of textFiles) {
      contentParts.push({
        type: "text",

        text: `\n\n--- File: ${textFile.name} ---\n${textFile.content}`,
      });
    }

    // Handle legacy 'context' type from old webui (pasted content)

    const legacyContextFiles = message.extra.filter(
      (
        extra: DatabaseMessageExtra,
      ): extra is DatabaseMessageExtraLegacyContext => extra.type === "context",
    );

    for (const legacyContextFile of legacyContextFiles) {
      contentParts.push({
        type: "text",

        text: `\n\n--- File: ${legacyContextFile.name} ---\n${legacyContextFile.content}`,
      });
    }

    const audioFiles = message.extra.filter(
      (extra: DatabaseMessageExtra): extra is DatabaseMessageExtraAudioFile =>
        extra.type === "audioFile",
    );

    for (const audio of audioFiles) {
      contentParts.push({
        type: "input_audio",

        input_audio: {
          data: audio.base64Data,

          format: audio.mimeType.includes("wav") ? "wav" : "mp3",
        },
      });
    }

    const pdfFiles = message.extra.filter(
      (extra: DatabaseMessageExtra): extra is DatabaseMessageExtraPdfFile =>
        extra.type === "pdfFile",
    );

    for (const pdfFile of pdfFiles) {
      if (pdfFile.processedAsImages && pdfFile.images) {
        for (let i = 0; i < pdfFile.images.length; i++) {
          contentParts.push({
            type: "image_url",

            image_url: { url: pdfFile.images[i] },
          });
        }
      } else {
        contentParts.push({
          type: "text",

          text: `\n\n--- PDF File: ${pdfFile.name} ---\n${pdfFile.content}`,
        });
      }
    }

    return {
      role: message.role as "user" | "assistant" | "system",

      content: contentParts,
    };
  }

  static async getServerProps(
    settings: Settings,
  ): Promise<ApiLlamaCppServerProps> {
    try {
      const apiKey = ""; // Not used

      const response = await fetch(`${settings.localLlmUrl}/props`, {
        headers: {
          "Content-Type": "application/json",

          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch server props: ${response.status}`);
      }

      const data = await response.json();

      return data;
    } catch (error) {
      console.error("Error fetching server props:", error);

      throw error;
    }
  }

  public abort(conversationId?: string): void {
    if (conversationId) {
      const abortController = this.abortControllers.get(conversationId);

      if (abortController) {
        abortController.abort();

        this.abortControllers.delete(conversationId);
      }
    } else {
      for (const controller of this.abortControllers.values()) {
        controller.abort();
      }

      this.abortControllers.clear();
    }
  }

  private injectSystemMessage(
    settings: Settings,
    messages: ApiChatMessageData[],
  ): ApiChatMessageData[] {
    const systemMessage = settings.systemPrompt?.toString().trim();

    if (!systemMessage) {
      return messages;
    }

    if (messages.length > 0 && messages[0].role === "system") {
      if (messages[0].content !== systemMessage) {
        const updatedMessages = [...messages];

        updatedMessages[0] = {
          role: "system",

          content: systemMessage,
        };

        return updatedMessages;
      }

      return messages;
    }

    const systemMsg: ApiChatMessageData = {
      role: "system",

      content: systemMessage,
    };

    return [systemMsg, ...messages];
  }

  private async parseErrorResponse(response: Response): Promise<Error> {
    try {
      const errorText = await response.text();

      const errorData: ApiErrorResponse = JSON.parse(errorText);

      const message = errorData.error?.message || "Unknown server error";

      const error = new Error(message);

      error.name = response.status === 400 ? "ServerError" : "HttpError";

      return error;
    } catch {
      const fallback = new Error(
        `Server error (${response.status}): ${response.statusText}`,
      );

      fallback.name = "HttpError";

      return fallback;
    }
  }

  private extractModelName(data: unknown): string | undefined {
    const asRecord = (value: unknown): Record<string, unknown> | undefined => {
      return typeof value === "object" && value !== null
        ? (value as Record<string, unknown>)
        : undefined;
    };

    const getTrimmedString = (value: unknown): string | undefined => {
      return typeof value === "string" && value.trim()
        ? value.trim()
        : undefined;
    };

    const root = asRecord(data);

    if (!root) return undefined;

    const rootModel = getTrimmedString(root.model);

    if (rootModel) return rootModel;

    const firstChoice = Array.isArray(root.choices)
      ? asRecord(root.choices[0])
      : undefined;

    if (!firstChoice) return undefined;

    const deltaModel = getTrimmedString(asRecord(firstChoice.delta)?.model);

    if (deltaModel) return deltaModel;

    const messageModel = getTrimmedString(asRecord(firstChoice.message)?.model);

    if (messageModel) return messageModel;

    return undefined;
  }

  private updateProcessingState(
    settings: Settings,

    timings?: ChatMessageTimings,

    promptProgress?: ChatMessagePromptProgress,

    conversationId?: string,
  ): void {
    const tokensPerSecond =
      timings?.predicted_ms && timings?.predicted_n
        ? (timings.predicted_n / timings.predicted_ms) * 1000
        : 0;

    slotsService

      .updateFromTimingData(
        settings,

        {
          prompt_n: timings?.prompt_n || 0,

          predicted_n: timings?.predicted_n || 0,

          predicted_per_second: tokensPerSecond,

          cache_n: timings?.cache_n || 0,

          prompt_progress: promptProgress,
        },

        conversationId,
      )

      .catch((error) => {
        console.warn("Failed to update processing state:", error);
      });
  }
}

export const chatService = new ChatService();
