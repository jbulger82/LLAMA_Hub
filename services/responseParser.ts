export interface ParsedResponse {
    thinking: string | null;
    toolCommand: string | null;
    content: string;
    rawResponse: string;
}

// Allow optional leading whitespace before slash commands so indented tool calls are still detected.
const COMMAND_REGEX = /^\s*\/(search|canvas|python|mcp|gdrive|gmail|deepresearch|save|embed)\s.+/gim;

export function parseAssistantResponse(rawResponse: string): ParsedResponse {
    let thinking: string | null = null;
    let toolCommand: string | null = null;
    let content = rawResponse || '';

    // Strictly parse <think> ... </think> (or open-ended during stream)
    const thinkMatch = rawResponse.match(/<think>(?:[\s\S]*?)(?:<\/think>|$)/i);
    if (thinkMatch) {
        thinking = thinkMatch[0]
            .replace(/<think>/i, '')
            .replace(/<\/think>/i, '')
            .trim();
        content = content.replace(thinkMatch[0], '').trim();
    }

    // Find commands in remaining content; take the last one
    const commands = content.match(COMMAND_REGEX);
    if (commands && commands.length > 0) {
        toolCommand = commands[commands.length - 1].trim();
        content = content.replace(toolCommand, '').trim();
    }

    return {
        thinking: thinking || null,
        toolCommand,
        content: content.trim(),
        rawResponse,
    };
}
