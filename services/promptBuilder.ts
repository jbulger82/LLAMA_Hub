import { type Message, Role, type PromptFormat } from '../types';
import { type Settings } from './settings';
import * as googleAuthService from './googleAuthService';
import { buildGptOssPrompt } from './gptOssPromptBuilder';

const formatMessagesForCustomTemplate = (messages: Message[]): string => {
    return messages
        .map(msg => {
            const roleLabel = msg.role === Role.USER ? 'USER' : 'ASSISTANT';
            return `[${roleLabel} MESSAGE]\n${msg.content}`;
        })
        .join('\n\n');
};

const renderCustomTemplate = (template: string, system: string, messages: Message[]): string => {
    const replacements: Record<string, string> = {
        system: system || '',
        messages: formatMessagesForCustomTemplate(messages),
        latest_user: [...messages].reverse().find(m => m.role === Role.USER)?.content || '',
    };

    return Object.entries(replacements).reduce((output, [key, value]) => {
        const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
        return output.replace(pattern, value);
    }, template);
};

export const CUSTOM_PROMPT_TEMPLATE_HELP = 'Use {{system}} for the active system instruction, {{messages}} for the entire chat transcription (role-labelled), and {{latest_user}} for only the most recent user message.';

const buildLlama3 = (system: string, messages: Message[]): string => {
    let prompt = "<|begin_of_text|>";
    if (system) {
        prompt += `<|start_header_id|>system<|end_header_id|>\n\n${system}<|eot_id|>`;
    }
    messages.forEach(msg => {
        // The Role enum is 'user' or 'assistant', which matches what Llama3 expects.
        prompt += `<|start_header_id|>${msg.role}<|end_header_id|>\n\n${msg.content}<|eot_id|>`;
    });
    prompt += `<|start_header_id|>assistant<|end_header_id|>\n\n`;
    return prompt;
};


const buildChatML = (system: string, messages: Message[]): string => {
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

const buildMiroThinker = (system: string, messages: Message[]): string => {
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

const buildGemma = (system: string, messages: Message[]): string => {
    let prompt = '';
    messages.forEach((msg, index) => {
        let content = msg.content;
        // Gemma traditionally folds the system prompt into the first user turn.
        if (index === 0 && system) {
            content = `${system}\n\n${content}`;
        }
        prompt += `<start_of_turn>${msg.role === Role.USER ? 'user' : 'model'}\n${content}<end_of_turn>\n`;
    });
    prompt += `<start_of_turn>model`;
    return prompt;
};

const buildDeepseekCoder = (system: string, messages: Message[]): string => {
    let prompt = system || `You are an AI programming assistant, utilizing the Deepseek Coder model, developed by Deepseek Company. For inquiries regarding creation and Deepseek Coder, refer to the Deepseek Coder website.`;
    prompt += "\n";
    messages.forEach(msg => {
        prompt += msg.role === Role.USER ? `[USER_INSTRUCTION]\n${msg.content}\n` : `[ASSISTANT_RESPONSE]\n${msg.content}\n`;
    });
    prompt += `[ASSISTANT_RESPONSE]\n`;
    return prompt;
};

const buildGptOss = (system: string, messages: Message[]): string => {
    return buildGptOssPrompt(system, messages);
};

export const buildRawPrompt = (format: PromptFormat, system: string, messages: Message[], customTemplate?: string): string => {
    if (customTemplate && customTemplate.trim()) {
        return renderCustomTemplate(customTemplate, system, messages);
    }
    switch (format) {
        case 'llama3':
            return buildLlama3(system, messages);
        case 'chatml':
            return buildChatML(system, messages);
        case 'mirothinker':
            return buildMiroThinker(system, messages);
        case 'gemma':
            return buildGemma(system, messages);
        case 'deepseek-coder':
            return buildDeepseekCoder(system, messages);
        case 'gpt-oss':
            return buildGptOss(system, messages);
        default:
            return ''; // Should not happen for raw prompt formats
    }
}

export const buildPromptPreview = (format: PromptFormat, customTemplate?: string): string => {
    const system_prompt = "You are a helpful AI assistant.";
    const sample_messages: Message[] = [
        { id: 'sample-1', role: Role.USER, content: "Hello, who are you?" },
        { id: 'sample-2', role: Role.ASSISTANT, content: "I am your local AI assistant." },
        { id: 'sample-3', role: Role.USER, content: "What can you do?" },
    ];

    if (format === 'openai-gemma2') {
        return JSON.stringify([
            { role: 'system', content: system_prompt },
            { role: 'user', content: 'Hello, who are you?' },
            { role: 'assistant', content: 'I am your local AI assistant.' },
            { role: 'user', content: 'What can you do?' }
        ], null, 2);
    }

    if (format === 'jinja') {
        return 'Prompt handled entirely by llama.cpp chat_template. LlamaHub sends raw chat messages without extra wrapping.';
    }
    
    // We only provide up to the last user message for the prompt
    const messagesForPrompt = sample_messages.filter(m => m.role === 'user' || m.role === 'assistant');

    if (format === 'gpt-oss' && !(customTemplate && customTemplate.trim())) {
        return buildGptOss(system_prompt, messagesForPrompt);
    }

    if (format === 'mirothinker' && !(customTemplate && customTemplate.trim())) {
        return buildMiroThinker(system_prompt, messagesForPrompt);
    }

    return buildRawPrompt(format, system_prompt, messagesForPrompt, customTemplate);
}

export function buildToolRoster(settings: Settings): string[] {
  const tools: string[] = [
    'search',
    'curl',
    'webscrape',
    'analyze website',
    'analyze links',
    'download',
    'read file',
    'canvas open',
    'canvas new file',
    'canvas edit file',
    'canvas list files',
    'canvas read file',
    '/python',
    'generate bash script',
    'explain code',
    'refactor code',
    'read knowledge',
    'save to memory',
    'export memory',
    'delete from memory',
    'deepresearch',
    'generate search queries',
    'system status',
    'disk usage',
    'list processes',
    'list files',
    'kill process',
    'ping',
    'whoami',
    'report',
  ];

  if (settings.imageGenerationProvider !== 'none') {
    tools.push('generate image');
  }

  if (settings.socialIntegrations.discord.connected) {
    tools.push('discord send');
  }

  if (googleAuthService.isSignedIn()) {
    tools.push(
      'gdrive list',
      'gdrive analyze',
      'gmail search',
      'gmail read',
      'gmail delete',
      'gmail send',
      'gcal list',
    );
  }

  if (settings.ragEnabled) {
    tools.push('read knowledge');
  }

  if (settings.mcpServers.some(s => s.enabled)) {
      tools.push('mcp submit deepresearch', 'mcp list', 'mcp status', 'mcp cancel', 'mcp results');
  }
  
  return [...new Set(tools)];
}

export function buildSystemPrompt(basePrompt: string, settings: Settings): string {
  const roster = buildToolRoster(settings).map(t => `- ${t}`).join('\n');
  const memoryInstructions = `
--- Memory Instructions ---
If the user asks for information about themselves (e.g., phone number, email, tech stack), and you have previously saved their personal information to memory, assume it is stored under a memory item named "content" as a YAML document. You should parse this YAML content to extract the requested details. For example, if asked for a phone number, look for 'person.phones' in the YAML.
`;
  return `${basePrompt}${memoryInstructions}\nTOOLS AVAILABLE (runtime):\n${roster}\n\nRules recap:\n- If a tool is needed, output ONLY the command on the first line.\n- No XML/channels.`;
}
