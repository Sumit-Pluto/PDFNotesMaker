import type { Snippet, PackingConfig } from '../types';

const DB_NAME = 'PdfNotesMakerDB';
const DB_VERSION = 1;
const STORE_NAME = 'session_store';
const SESSION_KEY = 'current_session';

export interface SavedSession {
  snippets: Snippet[];
  config: PackingConfig;
  activeDocName?: string;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSessionBackup(
  snippets: Snippet[],
  config: PackingConfig,
  activeDocName?: string
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const sessionData: SavedSession = {
      snippets,
      config,
      activeDocName,
      timestamp: Date.now(),
    };

    store.put(sessionData, SESSION_KEY);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('Could not save session backup to IndexedDB:', err);
  }
}

export async function loadSavedSession(): Promise<SavedSession | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(SESSION_KEY);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        const data = request.result as SavedSession | undefined;
        if (data && data.snippets && data.snippets.length > 0) {
          resolve(data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn('Could not load session backup from IndexedDB:', err);
    return null;
  }
}

export async function clearSavedSession(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(SESSION_KEY);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('Could not clear session backup from IndexedDB:', err);
  }
}
