export enum Role {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  thinking?: string | null;
  toolInfo?: {
    command: string;
    output: string;
  };
  type?: 'user' | 'assistant' | 'status';
  isCommand?: boolean;
  isError?: boolean;
  isThinking?: boolean;
  isCommandResponse?: boolean;
  sourceLabel?: string;
  isEdited?: boolean;
  imageUrl?: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  isArchived?: boolean;
  lastAutoMemorySaveIndex?: number;
  consecutiveToolErrors?: number;
}

export type SocialPlatformId =
  | 'facebook' | 'instagram' | 'threads' | 'tiktok' | 'twitter' | 'linkedin'
  | 'youtube' | 'googleBusiness' | 'shopify' | 'reddit' | 'telegram'
  | 'discord' | 'mastodon' | 'bluesky' | 'pinterest' | 'twitch'
  | 'snapchat' | 'whatsapp' | 'signal';

export interface PlatformConfig {
  name: string;
  id: SocialPlatformId;
  authType: 'oauth' | 'oauth_and_apikey' | 'apikey' | 'bot_token' | 'app_password';
  docsUrl: string;
  blocked?: boolean;
  blockedReason?: string;
}

export interface PlatformCredentials {
  apiKey?: string;
  apiSecret?: string;
  clientId?: string;
  accessToken?: string;
  refreshToken?: string;
  botToken?: string;
  appPassword?: string;
  connected?: boolean;
}

export const AGENT_ROLES = [
    'Orchestrator', 'Coder', 'Researcher', 'Web', 'Summarizer', 'Reviewer', 'FactChecker', 'Runner'
] as const;

export type AgentRole = typeof AGENT_ROLES[number];

export interface AgentConfig {
    provider: 'localLlm' | 'cloud';
    localLlmPort: string;
    cloudApiUrl: string;
    cloudApiKey: string;
    model: string;
    systemPrompt: string;
}

export interface MultiAgentSettings {
    enabled: boolean;
    agents: Record<AgentRole, AgentConfig>;
}

export interface McpServer {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  enabled: boolean;
}

export interface McpJob {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'paused' | 'complete' | 'error' | 'cancelled';
  statusMessage: string;
  payload: Record<string, any>;
  result?: any;
  createdAt: string;
  updatedAt: string;
}

export interface McpServerHealth {
    status: 'online' | 'offline' | 'degraded';
    latency: number | null;
    lastChecked: number;
}

export interface KnowledgeItem {
  id: string;
  parentId: string;
  parentName: string;
  type: 'file' | 'text';
  content: string;
  embedding: number[];
  createdAt: string;
  chunkIndex: number;
  totalChunks: number;
}

export interface SystemStats {
  cpu: number;
  mem: {
    total: number;
    used: number;
    usedPercent: number;
  };
  gpu: number;
}

export type ResearchJobStatus = 'running' | 'paused' | 'complete' | 'error' | 'confirm_factcheck';

export interface ResearchJob {
    id: string;
    topic: string;
    filePath: string;
    status: ResearchJobStatus;
    currentAgent: string | null;
    statusMessage: string;
    startTime: number;
    completedSteps: string[];
}

export type CanvasFileType = 'pdf' | 'docx' | 'txt' | 'md' | 'py' | 'img' | 'unsupported';

export interface CanvasFile {
  id: string;
  name: string;
  type: CanvasFileType;
  content: string;
}

export interface CommandResult {
    action: 'NONE' | 'MESSAGE_SENT' | 'STREAM_STARTED' | 'DEEP_RESEARCH_STARTED' | 'TRIGGER_RECOVERY_MODAL';
    isHandled: boolean;
    isFinal?: boolean;
    stream?: AsyncGenerator<string, void, unknown>;
    llmFollowUp?: boolean;
    message?: string;
    isCommandResponse?: boolean;
    llmPrompt?: string;
    sourceLabel?: string;
    imageUrl?: string;
    isError?: boolean;
}

export type PromptFormat = 'openai-gemma2' | 'llama3' | 'chatml' | 'gemma' | 'deepseek-coder' | 'gpt-oss' | 'jinja' | 'mirothinker';
export type PromptTemplateOverrides = Partial<Record<PromptFormat, string>>;
