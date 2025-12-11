/// <reference lib="webworker" />

// Dedicated RAG DB to avoid clashing with the app's generic IDB stores.
const DB_NAME = 'llamahub-rag-db';
// Bump version to recreate the store with keyPath and migrate off the blob layout.
const DB_VERSION = 2;
const KNOWLEDGE_STORE = 'rag-knowledge';

type WorkerRequest =
  | { type: 'LOAD'; requestId: number }
  | { type: 'SEARCH'; requestId: number; queryEmbedding: number[]; topK: number; similarityThreshold: number }
  | { type: 'ADD'; requestId: number; items: any[] }
  | { type: 'CLEAR'; requestId: number }
  | { type: 'LIST'; requestId: number };

type WorkerResponse =
  | { type: 'READY'; requestId?: number }
  | { type: 'LOAD_RESULT'; requestId: number; ok: boolean; error?: string }
  | { type: 'SEARCH_RESULT'; requestId: number; ok: boolean; results?: any[]; error?: string }
  | { type: 'ADD_RESULT'; requestId: number; ok: boolean; error?: string }
  | { type: 'CLEAR_RESULT'; requestId: number; ok: boolean; error?: string }
  | { type: 'LIST_RESULT'; requestId: number; ok: boolean; results?: any[]; error?: string };

// In-memory mirror for fast vector search
let memoryCache: any[] = [];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      // Migrate legacy blob store (version < 2) into granular rows
      if (request.oldVersion < 2 && db.objectStoreNames.contains(KNOWLEDGE_STORE)) {
        const tx = request.transaction;
        if (!tx) return;
        const oldStore = tx.objectStore(KNOWLEDGE_STORE);
        const legacyReq = oldStore.get('llamahub_knowledge' as any);
        legacyReq.onsuccess = () => {
          let legacyItems: any[] = [];
          const legacyVal = legacyReq.result;
          if (legacyVal && typeof legacyVal === 'string') {
            try {
              const parsed = JSON.parse(legacyVal);
              if (Array.isArray(parsed)) {
                legacyItems = parsed.map((item: any) => ({
                  ...item,
                  id: item.id || crypto.randomUUID(),
                }));
              }
            } catch (err) {
              console.error('[rag.worker] Legacy blob parse failed:', err);
            }
          }
          db.deleteObjectStore(KNOWLEDGE_STORE);
          const newStore = db.createObjectStore(KNOWLEDGE_STORE, { keyPath: 'id' });
          legacyItems.forEach(item => newStore.put(item));
        };
        legacyReq.onerror = () => {
          db.deleteObjectStore(KNOWLEDGE_STORE);
          db.createObjectStore(KNOWLEDGE_STORE, { keyPath: 'id' });
        };
      } else {
        if (db.objectStoreNames.contains(KNOWLEDGE_STORE)) {
          db.deleteObjectStore(KNOWLEDGE_STORE);
        }
        db.createObjectStore(KNOWLEDGE_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function loadAll(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KNOWLEDGE_STORE, 'readonly');
    const store = tx.objectStore(KNOWLEDGE_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const result: any[] = req.result || [];
      memoryCache = result;
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

async function addItems(items: any[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KNOWLEDGE_STORE, 'readwrite');
    const store = tx.objectStore(KNOWLEDGE_STORE);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    items.forEach(item => {
      if (!item.id) item.id = crypto.randomUUID();
      store.put(item);
      memoryCache.push(item);
    });
  });
}

async function clearStore(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KNOWLEDGE_STORE, 'readwrite');
    const store = tx.objectStore(KNOWLEDGE_STORE);
    const req = store.clear();
    req.onsuccess = () => {
      memoryCache = [];
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

function dotProduct(a: number[], b: number[]) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function magnitude(a: number[]) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * a[i];
  return Math.sqrt(sum);
}

function cosineSimilarity(a: number[], b: number[]) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

async function handleLoad(req: WorkerRequest) {
  try {
    await loadAll();
    postMessage({ type: 'LOAD_RESULT', requestId: req.requestId, ok: true } satisfies WorkerResponse);
  } catch (error: any) {
    console.error("RAG Worker Load Error:", error);
    postMessage({ type: 'LOAD_RESULT', requestId: req.requestId, ok: false, error: error.message } satisfies WorkerResponse);
  }
}

async function handleAdd(req: WorkerRequest & { items: any[] }) {
  try {
    await addItems(req.items);
    postMessage({ type: 'ADD_RESULT', requestId: req.requestId, ok: true } satisfies WorkerResponse);
  } catch (error: any) {
    console.error("RAG Worker Add Error:", error);
    postMessage({ type: 'ADD_RESULT', requestId: req.requestId, ok: false, error: error.message } satisfies WorkerResponse);
  }
}

async function handleClear(req: WorkerRequest) {
  try {
    await clearStore();
    postMessage({ type: 'CLEAR_RESULT', requestId: req.requestId, ok: true } satisfies WorkerResponse);
  } catch (error: any) {
    postMessage({ type: 'CLEAR_RESULT', requestId: req.requestId, ok: false, error: error.message } satisfies WorkerResponse);
  }
}

async function handleList(req: WorkerRequest) {
  try {
    if (memoryCache.length === 0) {
      await loadAll();
    }
    postMessage({ type: 'LIST_RESULT', requestId: req.requestId, ok: true, results: [...memoryCache] } satisfies WorkerResponse);
  } catch (error: any) {
    postMessage({ type: 'LIST_RESULT', requestId: req.requestId, ok: false, error: error.message } satisfies WorkerResponse);
  }
}

async function handleSearch(req: WorkerRequest & { queryEmbedding: number[]; topK: number; similarityThreshold: number }) {
  try {
    if (memoryCache.length === 0) await loadAll();

    const scores = new Float32Array(memoryCache.length);
    const indices = new Uint32Array(memoryCache.length);

    for (let i = 0; i < memoryCache.length; i++) {
      scores[i] = cosineSimilarity(req.queryEmbedding, memoryCache[i].embedding);
      indices[i] = i;
    }

    const filtered = Array.from(indices)
      .filter(i => scores[i] >= req.similarityThreshold)
      .sort((a, b) => scores[b] - scores[a])
      .slice(0, req.topK);

    const results = filtered.map(i => memoryCache[i]);

    postMessage({ type: 'SEARCH_RESULT', requestId: req.requestId, ok: true, results } satisfies WorkerResponse);
  } catch (error: any) {
    console.error("RAG Search Error", error);
    postMessage({ type: 'SEARCH_RESULT', requestId: req.requestId, ok: false, error: error.message } satisfies WorkerResponse);
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  if (!req || !req.type) return;

  switch (req.type) {
    case 'LOAD':
      handleLoad(req);
      break;
    case 'SEARCH':
      handleSearch(req as any);
      break;
    case 'ADD':
      handleAdd(req as any);
      break;
    case 'CLEAR':
      handleClear(req);
      break;
    case 'LIST':
      handleList(req);
      break;
    default:
      console.warn("Unknown worker request type:", (req as any).type);
      break;
  }
};

postMessage({ type: 'READY' } satisfies WorkerResponse);
