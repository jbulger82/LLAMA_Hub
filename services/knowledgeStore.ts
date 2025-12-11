import { cosineSimilarity } from '../lib/vectorUtils';
import * as localLlmService from './localLlmService';
import * as cloudLlmService from './cloudLlmService';
import { type KnowledgeItem } from '../types';
import * as chunkingService from './chunkingService';

// To satisfy TypeScript for globally included libraries
declare const pdfjsLib: any;
declare const mammoth: any;

const MAX_CONTEXT_TOKENS = 3500;
const DEFAULT_MAX_EMBED_TOKENS = 512;
const MIN_EMBED_TOKENS = 128;

interface RetrievalOptions {
    similarityThreshold: number;
    topK: number;
}

interface RetrievalResult {
    text: string;
    chunkCount: number;
    tokenCount: number;
}

interface KnowledgeConfig {
    aiProvider: 'localLlm' | 'cloud';
    embeddingProvider: 'auto' | 'local' | 'cloud';
    embeddingUrl: string;
    localLlmEmbeddingModel: string;
    geminiEmbeddingModel: string;
    customHeaders?: string;
    chunkSize: number;
    chunkOverlap: number;
    developerMode?: boolean;
    dev_geminiApiKey?: string;
    dev_openAiApiKey?: string;
    cloudProvider?: 'gemini' | 'openai';
    cloudApiUrl?: string;
    model?: string;
    maxEmbeddingTokens?: number;
}

let config: KnowledgeConfig = {
    aiProvider: 'cloud',
    embeddingProvider: 'auto',
    embeddingUrl: 'http://localhost:8080',
    localLlmEmbeddingModel: 'local-embedding-model',
    geminiEmbeddingModel: 'text-embedding-004',
    customHeaders: '{}',
    chunkSize: 768,
    chunkOverlap: 128,
    developerMode: false,
    dev_geminiApiKey: '',
    dev_openAiApiKey: '',
    cloudProvider: 'gemini',
    cloudApiUrl: 'https://api.openai.com/v1',
    model: 'gemini-2.5-flash',
    maxEmbeddingTokens: DEFAULT_MAX_EMBED_TOKENS,
};

type WorkerMessage =
    | { type: 'READY' }
    | { type: 'LOAD_RESULT'; requestId: number; ok: boolean; error?: string }
    | { type: 'SEARCH_RESULT'; requestId: number; ok: boolean; results?: KnowledgeItem[]; error?: string }
    | { type: 'ADD_RESULT'; requestId: number; ok: boolean; error?: string }
    | { type: 'CLEAR_RESULT'; requestId: number; ok: boolean; error?: string }
    | { type: 'LIST_RESULT'; requestId: number; ok: boolean; results?: KnowledgeItem[]; error?: string };

let ragWorker: Worker | null = null;
let requestIdCounter = 0;
const pendingRequests = new Map<number, { resolve: (value: any) => void; reject: (reason?: any) => void }>();

function getRagWorker(): Worker {
    if (!ragWorker) {
        const workerUrl = new URL('../workers/rag.worker.ts', import.meta.url);
        ragWorker = new Worker(workerUrl, { type: 'module' });

        ragWorker.onmessage = (event: MessageEvent<WorkerMessage>) => {
            const data = event.data;
            if ((data as any).requestId !== undefined) {
                const handler = pendingRequests.get((data as any).requestId);
                if (handler) {
                    pendingRequests.delete((data as any).requestId);
                    if ((data as any).ok === false) {
                        handler.reject(new Error((data as any).error || 'Worker error'));
                    } else {
                        handler.resolve(data);
                    }
                }
            }
        };

        ragWorker.onerror = (error) => {
            console.error("RAG Worker Error:", error);
            pendingRequests.forEach(({ reject }) => reject(error));
            pendingRequests.clear();
            ragWorker = null;
        };
    }
    return ragWorker;
}

function sendRequest<T = any>(payload: object): Promise<T> {
    const worker = getRagWorker();
    const requestId = ++requestIdCounter;
    return new Promise<T>((resolve, reject) => {
        pendingRequests.set(requestId, { resolve, reject });
        worker.postMessage({ ...payload, requestId });
    });
}

// --- File Reading Utilities ---
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(new Error(`Failed to read file as ArrayBuffer: ${file.name}`));
        reader.readAsArrayBuffer(file);
    });
}

function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error(`Failed to read file as text: ${file.name}`));
        reader.readAsText(file);
    });
}

async function readPdfAsText(file: File): Promise<string> {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let textContent = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const text = await page.getTextContent();
        textContent += text.items.map((s: any) => s.str).join(' ');
        textContent += '\n';
    }
    return textContent;
}

async function readDocxAsText(file: File): Promise<string> {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
}

export async function extractTextFromFile(file: File): Promise<string> {
    const fileType = file.type;
    const docxMimeTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
    ];

    if (fileType === 'application/pdf') {
        return readPdfAsText(file);
    } else if (docxMimeTypes.includes(fileType)) {
        return readDocxAsText(file);
    } else if (fileType.startsWith('text/') || fileType === 'application/json' || fileType.endsWith('+json')) {
        return readFileAsText(file);
    } else if (fileType.startsWith('image/')) {
        throw new Error(`Image files cannot be read as text. Use a vision-capable cloud model to analyze images.`);
    } else {
        try {
            return await readFileAsText(file);
        } catch (e) {
            throw new Error(`Unsupported file type for text extraction: ${fileType}. Please use PDF, DOCX, JSON, or plain text files.`);
        }
    }
}

async function getEmbeddings(text: string): Promise<number[]> {
    let provider: 'local' | 'cloud';

    if (config.embeddingProvider === 'local') {
        provider = 'local';
    } else if (config.embeddingProvider === 'cloud') {
        provider = 'cloud';
    } else { // 'auto'
        provider = config.aiProvider === 'localLlm' ? 'local' : 'cloud';
    }
    
    try {
      if (provider === 'cloud') {
          const getApiKey = (): string => {
              if (config.developerMode) {
                  return config.cloudProvider === 'openai' 
                      ? config.dev_openAiApiKey || '' 
                      : config.dev_geminiApiKey || '';
              }
              return process.env.API_KEY || '';
          };
          const apiKey = getApiKey();

          if (config.cloudProvider === 'openai') {
              if (!config.cloudApiUrl) {
                   throw new Error("OpenAI-Compatible Base URL is not configured for embeddings.");
              }
              if (!config.model) {
                  throw new Error("OpenAI-Compatible Model Name is not configured for embeddings.");
              }
              return await cloudLlmService.getOpenAIEmbeddings(text, config.model, config.cloudApiUrl, apiKey);
          } else {
              return await cloudLlmService.getEmbeddings(text, config.geminiEmbeddingModel, apiKey);
          }
      } else {
          return await localLlmService.getEmbeddings(text, {
              url: config.embeddingUrl,
              model: config.localLlmEmbeddingModel,
              customHeaders: config.customHeaders,
          });
      }
    } catch (error) {
      const source = provider === 'local' ? `local server at ${config.embeddingUrl}` : `cloud (${config.cloudProvider || 'gemini'})`;
      console.error(`Failed to get embeddings from ${source}:`, error);
      throw new Error(`Could not get embeddings using ${source}. Is your configuration correct? Details: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function embedAndStoreChunks(chunks: string[], parentName: string, type: 'file' | 'text', onStatusUpdate?: (status: string) => void): Promise<{ parentId: string; totalChunks: number }> {
    const parentId = `${type}_${Date.now()}`;
    const createdAt = new Date().toISOString();
    const totalChunks = chunks.length;
    const items: KnowledgeItem[] = [];

    for (let i = 0; i < totalChunks; i++) {
        const chunk = chunks[i];
        onStatusUpdate?.(`Embedding chunk ${i + 1} of ${totalChunks} for "${parentName}"...`);
        let embedding: number[];
        try {
            embedding = await getEmbeddings(chunk);
        } catch (error) {
            if (isInputTooLargeError(error)) {
                throw new Error(`Chunk ${i + 1} of "${parentName}" is still too large (~${countTokens(chunk)} tokens). Try lowering the chunk size in Settings > Memory & RAG or splitting the source material.`);
            }
            throw error;
        }
        if (embedding.length === 0) {
            throw new Error(`Failed to generate embedding for chunk ${i+1} of "${parentName}".`);
        }
        
        const newItem: KnowledgeItem = {
            id: `chunk_${parentId}_${i}`,
            parentId,
            parentName,
            type,
            content: chunk,
            embedding,
            createdAt,
            chunkIndex: i,
            totalChunks,
        };
        items.push(newItem);
    }

    await sendRequest({ type: 'ADD', items });
    return { parentId, totalChunks };
}

function countTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

function approximateCharLimit(tokenLimit: number): number {
    return Math.max(tokenLimit * 4, 1);
}

function hardSplitChunk(text: string, tokenLimit: number): string[] {
    const charLimit = approximateCharLimit(tokenLimit);
    if (charLimit <= 0) {
        throw new Error("Calculated character limit is invalid. Please check the token limit.");
    }
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += charLimit) {
        chunks.push(text.substring(i, i + charLimit));
    }
    return chunks;
}

function enforceEmbeddingLimits(chunks: string[], onStatusUpdate?: (status: string) => void): string[] {
    const maxTokens = config.maxEmbeddingTokens ?? DEFAULT_MAX_EMBED_TOKENS;
    if (maxTokens < MIN_EMBED_TOKENS) {
        throw new Error(`The max embedding token limit is set too low (${maxTokens}). Please choose a value of at least ${MIN_EMBED_TOKENS}.`);
    }

    const adjusted: string[] = [];
    chunks.forEach((chunk, index) => {
        const tokenCount = countTokens(chunk);
        if (tokenCount <= maxTokens) {
            adjusted.push(chunk);
        } else {
            const splitChunks = hardSplitChunk(chunk, maxTokens);
            onStatusUpdate?.(`Chunk ${index + 1} exceeded the ${maxTokens}-token limit. It was split into ${splitChunks.length} smaller chunks.`);
            adjusted.push(...splitChunks);
        }
    });
    return adjusted;
}

function isInputTooLargeError(error: unknown): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return message.includes('input is too large') || message.includes('physical batch size');
}

export function configure(newConfig: Partial<KnowledgeConfig>) {
    config = { ...config, ...newConfig };
}

export async function initKnowledgeStore() {
    try {
        await sendRequest({ type: 'LOAD' });
    } catch (error) {
        console.error("Failed to initialize knowledge store from IDB via worker:", error);
    }
}

export interface ParentDocument {
    id: string;
    name: string;
    type: 'file' | 'text';
    createdAt: string;
    chunkCount: number;
    content?: string;
}

async function fetchAllKnowledge(): Promise<KnowledgeItem[]> {
    const resp = await sendRequest<{ type: 'LIST_RESULT'; results?: KnowledgeItem[] }>({ type: 'LIST' });
    if ((resp as any).results) {
        return (resp as any).results as KnowledgeItem[];
    }
    return [];
}

export async function getAllParentDocuments(): Promise<ParentDocument[]> {
    const knowledge = await fetchAllKnowledge();
    const parents: Map<string, ParentDocument> = new Map();
    const sortedKnowledge = [...knowledge].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    for (const item of sortedKnowledge) {
        if (!parents.has(item.parentId)) {
            parents.set(item.parentId, {
                id: item.parentId,
                name: item.parentName,
                type: item.type,
                createdAt: item.createdAt,
                chunkCount: item.totalChunks,
            });
        }
    }
    return Array.from(parents.values());
}

export async function clearKnowledgeStore() {
    await sendRequest({ type: 'CLEAR' });
}

async function mutateKnowledge(update: (items: KnowledgeItem[]) => KnowledgeItem[]): Promise<KnowledgeItem[]> {
    const all = await fetchAllKnowledge();
    const updated = update(all);
    await sendRequest({ type: 'CLEAR' });
    if (updated.length > 0) {
        await sendRequest({ type: 'ADD', items: updated });
    }
    return updated;
}

export async function deleteParentByName(parentName: string): Promise<boolean> {
    const normalized = parentName.toLowerCase();
    const updated = await mutateKnowledge(items => items.filter(i => i.parentName.toLowerCase() !== normalized));
    return updated.length >= 0;
}

export async function deleteParentById(parentId: string): Promise<boolean> {
    const updated = await mutateKnowledge(items => items.filter(i => i.parentId !== parentId));
    return updated.length >= 0;
}

export async function exportKnowledge(): Promise<string> {
    const all = await fetchAllKnowledge();
    return JSON.stringify(all, null, 2);
}

export async function getParentDocument(parentId: string): Promise<ParentDocument | null> {
    const all = await fetchAllKnowledge();
    const items = all
        .filter(i => i.parentId === parentId)
        .sort((a, b) => a.chunkIndex - b.chunkIndex);

    if (items.length === 0) return null;

    const first = items[0];
    const content = items.map(i => i.content).join('\n\n');
    const chunkCount = Math.max(items.length, first.totalChunks || items.length);

    return {
        id: parentId,
        name: first.parentName,
        type: first.type,
        createdAt: first.createdAt,
        chunkCount,
        content,
    };
}

export async function exportParentDocument(parentId: string): Promise<string> {
    const all = await fetchAllKnowledge();
    const items = all.filter(i => i.parentId === parentId);
    return JSON.stringify(items, null, 2);
}

export async function addText(content: string, name: string = 'Memory Snippet', onStatusUpdate?: (status: string) => void): Promise<string> {
    const initialChunks = chunkingService.chunkText(content, { chunkSize: config.chunkSize, chunkOverlap: config.chunkOverlap });
    const chunks = enforceEmbeddingLimits(initialChunks, onStatusUpdate);
    const { totalChunks } = await embedAndStoreChunks(chunks, name, 'text', onStatusUpdate);
    onStatusUpdate?.('Saved to memory.');
    return `Successfully chunked and saved "${name}" (${totalChunks} chunks) to knowledge base.`;
}

export async function addFile(file: File, onStatusUpdate?: (status: string) => void): Promise<string> {
  onStatusUpdate?.(`Reading file "${file.name}"...`);
  
  let content = '';
  try {
      content = await extractTextFromFile(file);
  } catch (error) {
      console.error("Error reading file:", error);
      throw error;
  }

  onStatusUpdate?.(`Chunking "${file.name}"...`);
  const initialChunks = chunkingService.chunkText(content, { chunkSize: config.chunkSize, chunkOverlap: config.chunkOverlap });
  const chunks = enforceEmbeddingLimits(initialChunks, onStatusUpdate);

  const { totalChunks } = await embedAndStoreChunks(chunks, file.name, 'file', onStatusUpdate);
  onStatusUpdate?.(`Successfully saved "${file.name}" (${totalChunks} chunks) to knowledge base.`);
  return `Successfully saved "${file.name}" (${totalChunks} chunks) to knowledge base.`;
}

export async function addFileWithMeta(file: File, onStatusUpdate?: (status: string) => void): Promise<{ message: string; parentId: string; parentName: string; chunkCount: number }> {
    onStatusUpdate?.(`Reading file "${file.name}"...`);

    let content = '';
    try {
        content = await extractTextFromFile(file);
    } catch (error) {
        console.error("Error reading file:", error);
        throw error;
    }

    onStatusUpdate?.(`Chunking "${file.name}"...`);
    const initialChunks = chunkingService.chunkText(content, { chunkSize: config.chunkSize, chunkOverlap: config.chunkOverlap });
    const chunks = enforceEmbeddingLimits(initialChunks, onStatusUpdate);

    const { parentId, totalChunks } = await embedAndStoreChunks(chunks, file.name, 'file', onStatusUpdate);
    const message = `Successfully saved "${file.name}" (${totalChunks} chunks) to knowledge base.`;
    onStatusUpdate?.(message);
    return { message, parentId, parentName: file.name, chunkCount: totalChunks };
}

export async function retrieveRelevantContext(userQuery: string, options: RetrievalOptions): Promise<RetrievalResult> {
    // Clamp the query to avoid exceeding embedding context windows.
    const maxQueryTokens = 6000; // Conservative cap to stay under common 8k embedding limits.
    const maxChars = approximateCharLimit(maxQueryTokens);
    const safeQuery = userQuery.length > maxChars ? userQuery.slice(-maxChars) : userQuery;

    const embedding = await getEmbeddings(safeQuery);
    const topK = Math.max(1, options.topK || 5);
    const primaryThreshold = Math.min(Math.max(options.similarityThreshold ?? 0.2, 0), 0.99);

    const searchOnce = async (threshold: number) => {
        const resp = await sendRequest<{ type: 'SEARCH_RESULT'; results?: KnowledgeItem[] }>({
            type: 'SEARCH',
            queryEmbedding: embedding,
            topK,
            similarityThreshold: threshold,
        });
        return (resp as any).results as KnowledgeItem[] || [];
    };

    let relevantItems = await searchOnce(primaryThreshold);
    if (relevantItems.length === 0 && primaryThreshold > 0.2) {
        relevantItems = await searchOnce(0.2);
    }

    const text = relevantItems.map(item => item.content).join('\n\n');
    const tokenCount = relevantItems.reduce((sum, item) => sum + countTokens(item.content), 0);

    return {
        text,
        chunkCount: relevantItems.length,
        tokenCount,
    };
}

export async function findRelevantContext(userQuery: string, options: RetrievalOptions): Promise<RetrievalResult> {
    return retrieveRelevantContext(userQuery, options);
}

export async function readKnowledge(name: string): Promise<string> {
    const normalize = (n: string) => n.trim().replace(/^['"`]+/, '').replace(/['"`]+$/, '');
    const targetName = normalize(name);
    const all = await fetchAllKnowledge();
    const targetParent = all.find(i => i.parentName.toLowerCase() === targetName.toLowerCase());
    if (!targetParent) {
        throw new Error(`Knowledge item "${targetName}" not found.`);
    }
    const combined = all
        .filter(i => i.parentId === targetParent.parentId)
        .sort((a, b) => a.chunkIndex - b.chunkIndex)
        .map(i => i.content)
        .join('\n\n');
    return combined;
}

export async function getUsageStats() {
    const knowledge = await fetchAllKnowledge();
    const totalChunks = knowledge.length;
    const totalTokens = knowledge.reduce((sum, item) => sum + countTokens(item.content), 0);
    const avgTokens = totalChunks > 0 ? Math.round(totalTokens / totalChunks) : 0;
    const parents = await getAllParentDocuments();
    return {
        totalChunks,
        totalTokens,
        avgTokens,
        documents: parents.length,
    };
}
