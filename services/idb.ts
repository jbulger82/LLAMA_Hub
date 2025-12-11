// Lightweight IndexedDB helpers with graceful fallback to localStorage.

const DB_NAME = 'llamahub-db';
const DB_VERSION = 2;
const DEFAULT_STORE = 'app';
const KNOWLEDGE_STORE = 'knowledge';

type StoreName = typeof DEFAULT_STORE | typeof KNOWLEDGE_STORE;

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(DEFAULT_STORE)) {
                db.createObjectStore(DEFAULT_STORE);
            }
            if (!db.objectStoreNames.contains(KNOWLEDGE_STORE)) {
                db.createObjectStore(KNOWLEDGE_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
    });
}

async function withStore<T>(storeName: StoreName, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await openDb();
    return new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
    });
}

export async function idbGet(key: string, storeName: StoreName = DEFAULT_STORE): Promise<string | null> {
    try {
        return await withStore(storeName, 'readonly', store => store.get(key));
    } catch (error) {
        console.warn('[idb] get fallback to localStorage due to error:', error);
        return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    }
}

export async function idbSet(key: string, value: string, storeName: StoreName = DEFAULT_STORE): Promise<void> {
    try {
        await withStore(storeName, 'readwrite', store => store.put(value, key));
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(key);
        }
    } catch (error) {
        console.warn('[idb] set fallback to localStorage due to error:', error);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, value);
        }
    }
}

export async function idbDel(key: string, storeName: StoreName = DEFAULT_STORE): Promise<void> {
    try {
        await withStore(storeName, 'readwrite', store => store.delete(key));
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(key);
        }
    } catch (error) {
        console.warn('[idb] delete fallback to localStorage due to error:', error);
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(key);
        }
    }
}

export const idbStores = {
    DEFAULT_STORE,
    KNOWLEDGE_STORE,
};
