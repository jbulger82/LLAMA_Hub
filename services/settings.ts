import { SYSTEM_INSTRUCTION } from '../constants';
import { type SocialPlatformId, type PlatformCredentials, type MultiAgentSettings, AGENT_ROLES, type AgentConfig, type McpServer, type AgentRole, type PromptFormat, type PromptTemplateOverrides } from '../types';
import { AGENT_PERSONAS } from './agentPersonas';

const isBrowser = typeof window !== 'undefined';
const DEFAULT_HOSTNAME = (isBrowser && window.location?.hostname) ? window.location.hostname : 'localhost';
const withHost = (port: string | number, protocol: 'http' | 'https' | 'ws' = 'http') =>
  `${protocol}://${DEFAULT_HOSTNAME}:${port}`;

export const DAISYUI_THEMES = [
  "light", "dark", "cupcake", "bumblebee", "emerald", "corporate", "synthwave", 
  "retro", "cyberpunk", "valentine", "halloween", "garden", "forest", "aqua", 
  "lofi", "pastel", "fantasy", "wireframe", "black", "luxury", "dracula", "cmyk",
  "autumn", "business", "acid", "lemonade", "night", "coffee", "winter", "dim",
  "nord", "sunset", "abyss", "caramel", "latte", "silk", "auto"
];

export interface Settings {
  // General
  theme: string;
  fontSize: number; // in px
  sidebarWidth: number; // in px
  userName: string;
  startupGreeting: string;
  messageDensity: 'cozy' | 'compact' | 'ultra-compact';
  showFullPrompt: boolean;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  
  // Chat Behavior
  contextWindowSize: number; // Number of recent messages to send
  maxContextTokens: number; // Approximate token cap for active context

  // Voice & Audio
  voiceEnabled: boolean;
  readAloud: boolean;
  ttsProvider: 'browser' | 'piper' | 'systemPiper';
  ttsVoiceName: string;
  piperTtsUrl: string;
  sttProvider: 'browser' | 'vosk' | 'systemWhisper';
  voskSttUrl: string;
  enableSileroVad: boolean;
  enablePorcupineWakeWord: boolean;
  porcupineAccessKey: string;

  // Memory & RAG
  ragEnabled: boolean;
  embeddingProvider: 'auto' | 'local' | 'cloud';
  similarityThreshold: number; // 0.0 - 1.0
  topK: number; // RAG top_k
  knowledgeBaseRootPath: string;
  chunkSize: number; // in tokens
  chunkOverlap: number; // in tokens
  enableAutoMemory: boolean;
  autoMemoryInterval: number; // in messages
  useRagForAttachments: boolean;
  
  // AI Model
  aiProvider: 'localLlm' | 'cloud' | 'dev';
  cloudProvider: 'gemini' | 'openai';
  cloudApiUrl: string;
  enableThinking: boolean;
  thinkingBudget: number;
  reasoningLevel: 'low' | 'medium' | 'high';
  systemPrompt: string;

  // Multi-agent System
  multiAgentSettings: MultiAgentSettings;

  // MCP Server
  mcpServers: McpServer[];

  // Image Generation (Decoupled)
  imageGenerationProvider: 'none' | 'gemini' | 'openai' | 'local';
  imageGenerationModel: string;
  imageGenerationUrl: string;
  
  // Local LLM Settings
  localLlmUrl: string;
  localLlmEmbeddingUrl: string;
  localLlmModelName: string;
  localLlmEmbeddingModel: string;
  localLlmPromptFormat: PromptFormat;
  modelKeepAlive: string; // e.g., '5m', '1h', 'forever'
  customHeaders: string; // Stored as a JSON string
  contextLength: number;
  batchSize: number;
  mirostat: number;
  mirostatTau: number;
  mirostatEta: number;
  nKeep: number;
  
  // Performance
  threads: number;
  gpuLayers: number;
  ropeFrequencyBase: number;
  ropeFrequencyScale: number;
  useMmq: boolean;
  lowVram: boolean;
  numa: boolean;
  useMmap: boolean;
  useMlock: boolean;

  // Memory/Streaming
  enableKvCache: boolean;
  kvCacheSize: number;
  streamTokens: boolean;
  ignoreEot: boolean;
  promptCachePath: string;
  customPromptTemplates: PromptTemplateOverrides;
  
  // Experimental
  grammar: string;
  loraAdapterPath: string;
  embeddingModelPath: string;
  enablePython: boolean;
  pyodideUrl: string;
  enableSmartCanvas: boolean;
  pasteLengthToFile: number;

  // Cloud Settings (Gemini, OpenAI, etc.)
  model: string; // Model name for the selected cloud provider
  geminiEmbeddingModel: string;
  
  // Shared Model Parameters
  maxOutputTokens: number;
  temperature: number; // 0.0 - 2.0
  topP: number; // 0.0 - 1.0
  modelTopK: number; // Model top_k
  typicalP: number; // 0.0 - 1.0
  tfsZ: number;
  repetitionPenalty: number;
  repeatLastN: number;
  frequencyPenalty: number;
  presencePenalty: number;
  penalizeNewline: boolean;
  penaltyDryRunBase: number;
  penaltyDryRunAllowed: boolean;
  penaltyDryRunPenalty: number;
  seed: number;
  stopTokens: string; // Comma-separated
  
  // Networking & Web Access
  proxyUrl: string;
  proxyMode: 'auto' | 'local' | 'remote';
  corsProxyUrl: string;
  curlUserAgent: string;
  searchEngine: 'duckduckgo' | 'brave' | 'google' | 'custom' | 'tavily';
  customSearchApiEndpoint: string;
  googleSearchCxId: string;
  scrapestackApiKey: string;
  tavilyApiKey: string;
  webScrapingProvider: 'auto' | 'scrapestack';
  torModeEnabled: boolean;
  
  // Integrations
  socialIntegrations: Record<SocialPlatformId, PlatformCredentials>;
  recoveryPassphrase: string;

  // --- New llama.cpp settings ---
  // Context & Prompt
  inputPrefix: string;
  inputSuffix: string;
  antiPrompt: string; // Comma-separated
  cachePrompt: boolean;

  // Debug & Execution
  logprobs: number;
  perplexity: boolean;
  dumpPrompt: boolean;
  samplerOrder: string; // Comma-separated string of numbers
  logitBias: string; // JSON string
  logFullConversations: boolean;
  
  // Session & Advanced
  slotId: number;
  idPrefix: string;
  rawJsonOverrides: string; // JSON string
  developerMode: boolean;

  // Dev mode keys (bypassing .env)
  dev_geminiApiKey: string;
  dev_openAiApiKey: string;
  dev_googleClientId: string;
  dev_googleDeveloperApiKey: string;

  // Vision (Placeholders)
  imageData: string;
  imagePromptFormat: string;
}

const defaultPlatformCredentials = {
    apiKey: '',
    apiSecret: '',
    clientId: '',
    accessToken: '',
    refreshToken: '',
    botToken: '',
    appPassword: '',
    connected: false,
};

const defaultAgentConfig: AgentConfig = {
    provider: 'localLlm',
    localLlmPort: '8081',
    cloudApiUrl: '',
    cloudApiKey: '',
    model: '',
    systemPrompt: '',
};

const defaultEmbeddingAgentConfig = {
    ...defaultAgentConfig,
    localLlmPort: '8080',
};


export const DEFAULT_SETTINGS: Settings = {
  "theme": "business",
  "fontSize": 16,
  "sidebarWidth": 288,
  "userName": "User",
  "startupGreeting": "Welcome to LlamaHub",
  "messageDensity": "cozy",
  "showFullPrompt": false,
  "contactEmail": "",
  "contactPhone": "",
  "contactAddress": "",
  "contextWindowSize": 50,
  "maxContextTokens": 2048,
  "voiceEnabled": true,
  "readAloud": false,
  "ttsProvider": "browser",
  "ttsVoiceName": "",
  "piperTtsUrl": withHost(5002),
  "sttProvider": "browser",
  "voskSttUrl": withHost(2700, 'ws'),
  "enableSileroVad": false,
  "enablePorcupineWakeWord": false,
  "porcupineAccessKey": "",

  "ragEnabled": true,
  "embeddingProvider": "auto",
  "similarityThreshold": 0.2,
  "topK": 5,
  "knowledgeBaseRootPath": "~/Desktop/Knowledge/",
  "chunkSize": 768,
  "chunkOverlap": 128,
  "enableAutoMemory": true,
  "autoMemoryInterval": 20,
  "useRagForAttachments": true,

  "aiProvider": "localLlm",
  "cloudProvider": "gemini",
  "cloudApiUrl": "https://api.openai.com/v1",
  "enableThinking": true,
  "thinkingBudget": 24576,
  "reasoningLevel": "medium",
  "systemPrompt": SYSTEM_INSTRUCTION,

  "multiAgentSettings": {
    enabled: false,
    agents: Object.fromEntries(
      AGENT_ROLES.map(role => [
        role,
        {
          provider: 'localLlm',
          localLlmPort: (role === 'Researcher' || role === 'Web') ? '8080' : '8081',
          cloudApiUrl: '',
          cloudApiKey: '',
          model: '',
          systemPrompt: AGENT_PERSONAS[role],
        }
      ])
    ) as Record<AgentRole, AgentConfig>,
  },

  "mcpServers": [
    {
      name: "Playwright MCP",
      url: withHost(3005),
      enabled: true
    }
  ],

  "imageGenerationProvider": "none",
  "imageGenerationModel": "dall-e-3",
  "imageGenerationUrl": "",

  "localLlmUrl": withHost(8082),
  "localLlmEmbeddingUrl": withHost(8080),
  "localLlmModelName": "",
  "localLlmEmbeddingModel": "",
  "localLlmPromptFormat": "jinja",
  "modelKeepAlive": "5m",
  "customHeaders": "{}",
  "contextLength": 131072,
  "batchSize": 512,
  "mirostat": 0,
  "mirostatTau": 5.0,
  "mirostatEta": 0.1,
  "nKeep": 0,

  "threads": 0,
  "gpuLayers": -1,
  "ropeFrequencyBase": 0,
  "ropeFrequencyScale": 0,
  "useMmq": false,
  "lowVram": false,
  "numa": false,
  "useMmap": true,
  "useMlock": false,

  "enableKvCache": true,
  "kvCacheSize": 0,
  "streamTokens": true,
  "ignoreEot": false,
  "promptCachePath": "",
  "customPromptTemplates": {},

  "grammar": "",
  "loraAdapterPath": "",
  "embeddingModelPath": "",
  "enablePython": true,
  "pyodideUrl": "https://cdn.jsdelivr.net/pyodide/v0.29.0/full/pyodide.js",
  "enableSmartCanvas": true,
  "pasteLengthToFile": 2000,
  
  "model": "gemini-2.5-flash",
  "geminiEmbeddingModel": "text-embedding-004",

  "maxOutputTokens": 8192,
  "temperature": 0.7,
  "topP": 0.95,
  "modelTopK": 40,
  "typicalP": 1.0,
  "tfsZ": 1.0,
  "repetitionPenalty": 1.1,
  "repeatLastN": 64,
  "frequencyPenalty": 0.0,
  "presencePenalty": 0.0,
  "penalizeNewline": false,
  "penaltyDryRunBase": 1.0,
  "penaltyDryRunAllowed": false,
  "penaltyDryRunPenalty": 1.0,
  "seed": -1,
  "stopTokens": "",

  "proxyUrl": withHost(3001),
  "proxyMode": "auto",
  "corsProxyUrl": "https://r.jina.ai/http://",
  "curlUserAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
  "searchEngine": "tavily",
  "customSearchApiEndpoint": "",
  "googleSearchCxId": "",
  "scrapestackApiKey": "",
  "tavilyApiKey": "",
  "webScrapingProvider": "auto",
  "torModeEnabled": false,

  "socialIntegrations": {
    facebook: { ...defaultPlatformCredentials },
    instagram: { ...defaultPlatformCredentials },
    threads: { ...defaultPlatformCredentials },
    tiktok: { ...defaultPlatformCredentials },
    twitter: { ...defaultPlatformCredentials },
    linkedin: { ...defaultPlatformCredentials },
    youtube: { ...defaultPlatformCredentials },
    googleBusiness: { ...defaultPlatformCredentials },
    shopify: { ...defaultPlatformCredentials },
    reddit: { ...defaultPlatformCredentials },
    telegram: { ...defaultPlatformCredentials },
    discord: { ...defaultPlatformCredentials },
    mastodon: { ...defaultPlatformCredentials },
    bluesky: { ...defaultPlatformCredentials },
    pinterest: { ...defaultPlatformCredentials },
    twitch: { ...defaultPlatformCredentials },
    snapchat: { ...defaultPlatformCredentials },
    whatsapp: { ...defaultPlatformCredentials },
    signal: { ...defaultPlatformCredentials },
  },
  "recoveryPassphrase": "",

  "inputPrefix": "",
  "inputSuffix": "",
  "antiPrompt": "",
  "cachePrompt": false,

  "logprobs": 0,
  "perplexity": false,
  "dumpPrompt": false,
  "samplerOrder": "",
  "logitBias": "{}",
  "logFullConversations": false,

  "slotId": -1,
  "idPrefix": "",
  "rawJsonOverrides": "{}",
  "developerMode": true,

  "dev_geminiApiKey": "",
  "dev_openAiApiKey": "",
  "dev_googleClientId": "",
  "dev_googleDeveloperApiKey": "",
  
  "imageData": "",
  "imagePromptFormat": ""
};

const SETTINGS_STORAGE_KEY = 'llamahub_settings';

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
