// services/gptOssPromptBuilder.ts

import { type Message, Role } from '../types';

// --- Helpers --------------------------------------------------------------

function strftime(format: string): string {
    const date = new Date();
    return format
        .replace('%Y', date.getFullYear().toString())
        .replace('%m', (date.getMonth() + 1).toString().padStart(2, '0'))
        .replace('%d', date.getDate().toString().padStart(2, '0'));
}

/**
 * Prevent user / tool content from accidentally injecting control tokens
 * like `<|start|>` inside <|message|> blocks.
 */
function escapeMessageContent(content: string): string {
    if (typeof content !== 'string') {
        content = String(content);
    }
    // Break the special `<|` / `|>` patterns without changing meaning too much.
    return content
        .replace(/<\|/g, '<\\|')
        .replace(/\|>/g, '\\|>');
}

// --- Tool schema → TypeScript rendering ----------------------------------

function renderTypeScriptType(paramSpec: any, requiredParams: string[] = []): string {
    if (!paramSpec) return 'any';

    // array
    if (paramSpec.type === 'array') {
        if (paramSpec.items) {
            const inner = renderTypeScriptType(paramSpec.items, requiredParams);
            const innerWrapped = inner.includes(' | ') ? `(${inner})[]` : `${inner}[]`;
            return innerWrapped + (paramSpec.nullable ? ' | null' : '');
        }
        return 'any[]' + (paramSpec.nullable ? ' | null' : '');
    }

    // union type: ["string", "null"] etc.
    if (Array.isArray(paramSpec.type)) {
        const union = paramSpec.type.join(' | ');
        return union;
    }

    // oneOf
    if (paramSpec.oneOf) {
        const hasObjectVariants = paramSpec.oneOf.some((v: any) => v.type === 'object');
        if (hasObjectVariants && paramSpec.oneOf.length > 1) {
            // avoid giant nested discriminated unions – not worth it for the model
            return 'any';
        }
        const variants = paramSpec.oneOf.map((variant: any) =>
            renderTypeScriptType(variant, requiredParams),
        );
        const union = variants.join(' | ');
        return union;
    }

    // primitives
    if (paramSpec.type === 'string') {
        if (paramSpec.enum) {
            return paramSpec.enum.map((v: string) => `"${v}"`).join(' | ');
        }
        return 'string' + (paramSpec.nullable ? ' | null' : '');
    }

    if (paramSpec.type === 'number' || paramSpec.type === 'integer') {
        return 'number' + (paramSpec.nullable ? ' | null' : '');
    }

    if (paramSpec.type === 'boolean') {
        return 'boolean' + (paramSpec.nullable ? ' | null' : '');
    }

    // object
    if (paramSpec.type === 'object') {
        if (paramSpec.properties) {
            const required = paramSpec.required || [];
            const props = Object.entries(paramSpec.properties)
                .map(([propName, propSpec]: [string, any]) => {
                    const isRequired = required.includes(propName);
                    const propType = renderTypeScriptType(propSpec, required);
                    return `${propName}${isRequired ? '' : '?'}: ${propType}`;
                })
                .join(',\n');
            return `{\n${props}\n}`;
        }
        return 'Record<string, any>' + (paramSpec.nullable ? ' | null' : '');
    }

    return 'any';
}

function renderToolNamespace(namespaceName: string, tools: any[]): string {
    let result = `## ${namespaceName}\n\nnamespace ${namespaceName} {\n\n`;
    for (const tool of tools) {
        const func = tool.function;
        result += `// ${func.description || ''}\n`;
        result += `type ${func.name} = (_: `;
        if (func.parameters && func.parameters.properties && Object.keys(func.parameters.properties).length > 0) {
            const required = func.parameters.required || [];
            const params = Object.entries(func.parameters.properties)
                .map(([paramName, paramSpec]: [string, any]) => {
                    const isRequired = required.includes(paramName);
                    let paramDef = '';
                    if (paramSpec.description) {
                        paramDef += `// ${paramSpec.description}\n`;
                    }
                    const paramType = renderTypeScriptType(paramSpec, required);
                    paramDef += `${paramName}${isRequired ? '' : '?'}: ${paramType}`;
                    if (paramSpec.default !== undefined) {
                        paramDef += `, // default: ${JSON.stringify(paramSpec.default)}`;
                    }
                    return paramDef;
                })
                .join(',\n');
            result += `{\n${params}\n}) => any;\n\n`;
        } else {
            result += `() => any;\n\n`;
        }
    }
    result += `} // namespace ${namespaceName}\n`;
    return result;
}

// --- System message ------------------------------------------------------

function buildSystemMessage(
    model_identity?: string,
    reasoning_effort = 'medium',
    tools?: any[],
): string {
    let message = model_identity || 'You are ChatGPT, a large language model trained by OpenAI.\n';
    message += 'Knowledge cutoff: 2024-06\n';
    message += `Current date: ${strftime('%Y-%m-%d')}\n\n`;
    message += `Reasoning: ${reasoning_effort}\n\n`;
    message +=
        '# Valid channels: analysis, commentary, final. Channel must be included for every assistant message.\n';
    message +=
        'When responding, first write your detailed reasoning in the analysis channel, then write a concise user-facing answer in the final channel.\n';
    if (tools && tools.length > 0) {
        message +=
            "Calls to these tools must go to the commentary channel using the 'functions' namespace.\n";
    }
    return message;
}

// --- Prompt builder ------------------------------------------------------

export function buildGptOssPrompt(
    system: string,
    messages: Message[],
    tools?: any[],
    add_generation_prompt: boolean = true,
): string {
    let prompt = '';

    // 1) Hard system message (always ours)
    prompt += '<|start|>system<|message|>';
    prompt += buildSystemMessage(undefined, 'medium', tools);
    prompt += '<|end|>';

    // 2) Developer message: either the first system/developer in messages, or the provided `system` arg
    let developer_message = '';
    let loop_messages: Message[] = messages;

    if (
        messages.length > 0 &&
        (messages[0].role === 'system' || messages[0].role === 'developer')
    ) {
        developer_message = (messages[0].content as string) || '';
        loop_messages = messages.slice(1);
    } else if (system) {
        developer_message = system;
    }

    if (developer_message || (tools && tools.length > 0)) {
        prompt += '<|start|>developer<|message|>';
        if (developer_message) {
            prompt += `# Instructions\n\n${escapeMessageContent(developer_message)}`;
        }
        if (tools && tools.length > 0) {
            prompt += '\n\n# Tools\n\n';
            prompt += escapeMessageContent(renderToolNamespace('functions', tools));
        }
        prompt += '<|end|>';
    }

    // 3) Conversation history
    const toolCallIdToName = new Map<string, string>();
    let lastToolCallName: string | null = null;

    loop_messages.forEach((message, index) => {
        const isLast = index === loop_messages.length - 1;

        // ASSISTANT
        if (message.role === Role.ASSISTANT) {
            const m: any = message;
            const toolCalls = m.tool_calls || [];

            // If there were tool calls from this assistant turn:
            if (toolCalls.length > 0) {
                // Optional explanation content before tool calls -> analysis channel
                if (m.content) {
                    prompt += `<|start|>assistant<|channel|>analysis<|message|>${escapeMessageContent(
                        m.content as string,
                    )}<|end|>`;
                }

                for (const call of toolCalls) {
                    const func = call.function;
                    const args =
                        typeof func.arguments === 'string'
                            ? func.arguments
                            : JSON.stringify(func.arguments ?? {});
                    prompt += `<|start|>assistant to=functions.${func.name}<|channel|>commentary json<|message|>${escapeMessageContent(
                        args,
                    )}<|call|>`;

                    if (call.id) {
                        toolCallIdToName.set(call.id, func.name);
                    }
                    lastToolCallName = func.name;
                }
                return;
            }

            // If we have a stored `thinking` from a previous response, replay it as analysis
            const thinking: string | undefined = (m as any).thinking;
            if (thinking) {
                prompt += `<|start|>assistant<|channel|>analysis<|message|>${escapeMessageContent(
                    thinking,
                )}<|end|>`;
            }

            if (m.content) {
                if (!add_generation_prompt && isLast) {
                    // Completed trace: final message is marked with <|return|>
                    prompt += `<|start|>assistant<|channel|>final<|message|>${escapeMessageContent(
                        m.content as string,
                    )}<|return|>`;
                } else {
                    // Normal historical assistant reply
                    prompt += `<|start|>assistant<|channel|>final<|message|>${escapeMessageContent(
                        m.content as string,
                    )}<|end|>`;
                }
            }

            lastToolCallName = null;
            return;
        }

        // TOOL
        if (message.role === 'tool') {
            const m: any = message;
            let toolName: string | undefined;

            // Prefer explicit tool_call_id mapping if present
            if (m.tool_call_id && toolCallIdToName.has(m.tool_call_id)) {
                toolName = toolCallIdToName.get(m.tool_call_id)!;
            } else if (lastToolCallName) {
                toolName = lastToolCallName;
            }

            if (!toolName) {
                // If we can't confidently match this tool message to a call, skip it
                return;
            }

            const contentStr =
                typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? {});
            prompt += `<|start|>functions.${toolName} to=assistant<|channel|>commentary<|message|>${escapeMessageContent(
                contentStr,
            )}<|end|>`;
            return;
        }

        // USER
        if (message.role === Role.USER) {
            const content = typeof message.content === 'string'
                ? message.content
                : JSON.stringify(message.content ?? {});
            prompt += `<|start|>user<|message|>${escapeMessageContent(content)}<|end|>`;
            return;
        }

        // Other roles (if any) are ignored for now.
    });

    // 4) Generation stub
    if (add_generation_prompt) {
        // Ask the model to start by writing its reasoning in the analysis channel.
        prompt += '<|start|>assistant<|channel|>analysis<|message|>';
    }

    return prompt;
}

