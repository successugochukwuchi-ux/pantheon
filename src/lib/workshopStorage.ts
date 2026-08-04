const DB_NAME = 'ColearnVideoWorkshopDB';
const DB_VERSION = 2;
const STORE_NAME = 'audio_segments';
const SETTINGS_STORE = 'settings';

export const SETTINGS_KEYS = {
  OPENROUTER_API_KEY: 'openrouter_api_key',
  FISH_AUDIO_VOICE_MODEL_ID: 'fish_audio_voice_model_id',
  TTS_PROVIDER: 'tts_provider',
  SELECTED_VOICE: 'selected_voice'
};

export interface StoredAudioChunk {
  index: number;
  text: string;
  data: ArrayBuffer;
  timestamp: number;
}

/**
 * Opens or initializes the IndexedDB for Colearn Video Workshop
 */
export function openWorkshopDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser environment.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'index' });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves a workshop setting (e.g. OpenRouter API key, Custom Voice ID) into IndexedDB
 */
export async function saveWorkshopSetting(key: string, value: any): Promise<void> {
  try {
    const db = await openWorkshopDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS_STORE, 'readwrite');
      const store = tx.objectStore(SETTINGS_STORE);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to save setting to IndexedDB:', err);
  }
}

/**
 * Retrieves a workshop setting from IndexedDB
 */
export async function getWorkshopSetting<T>(key: string): Promise<T | null> {
  try {
    const db = await openWorkshopDB();
    return new Promise((resolve) => {
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        resolve(null);
        return;
      }
      const tx = db.transaction(SETTINGS_STORE, 'readonly');
      const store = tx.objectStore(SETTINGS_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Saves a single audio chunk (ArrayBuffer) into IndexedDB
 */
export async function saveAudioChunk(index: number, text: string, data: ArrayBuffer): Promise<void> {
  const db = await openWorkshopDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const item: StoredAudioChunk = {
      index,
      text,
      data,
      timestamp: Date.now(),
    };
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieves all stored audio chunks sorted by index
 */
export async function getAllAudioChunks(): Promise<StoredAudioChunk[]> {
  const db = await openWorkshopDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result as StoredAudioChunk[]) || [];
      items.sort((a, b) => a.index - b.index);
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Clears all stored audio chunks from IndexedDB
 */
export async function clearAudioChunks(): Promise<void> {
  const db = await openWorkshopDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Merges all chunks stored in IndexedDB into a single Blob and ArrayBuffer
 */
export async function getMergedAudioFromDB(): Promise<{ blob: Blob; buffer: ArrayBuffer; count: number } | null> {
  const chunks = await getAllAudioChunks();
  if (chunks.length === 0) return null;

  const totalLength = chunks.reduce((acc, c) => acc + c.data.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const c of chunks) {
    result.set(new Uint8Array(c.data), offset);
    offset += c.data.byteLength;
  }

  const buffer = result.buffer;
  const blob = new Blob([buffer], { type: 'audio/mpeg' });
  return { blob, buffer, count: chunks.length };
}

/**
 * Direct file downloader utility using Blob URL
 */
export function downloadBlobFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (document.body.contains(a)) {
      document.body.removeChild(a);
    }
    URL.revokeObjectURL(url);
  }, 1000);
}
