export class WorkspaceDB {
  private dbName = 'epub_creator_db';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return resolve(); // SSR/Node.js fallback
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata');
        }
        if (!db.objectStoreNames.contains('blobs')) {
          db.createObjectStore('blobs');
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => {
        this.initPromise = null;
        reject(request.error);
      };
    });

    return this.initPromise;
  }

  saveMetadata(key: string, value: any): Promise<void> {
    return this.write('metadata', key, value);
  }

  getMetadata(key: string): Promise<any> {
    return this.read('metadata', key);
  }

  saveBlob(uuid: string, blob: Blob): Promise<void> {
    return this.write('blobs', uuid, blob);
  }

  getBlob(uuid: string): Promise<Blob | null> {
    return this.read('blobs', uuid);
  }

  deleteBlob(uuid: string): Promise<void> {
    return this.delete('blobs', uuid);
  }

  clearAll(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.init().then(() => {
        if (!this.db) return resolve();
        const transaction = this.db.transaction(['metadata', 'blobs'], 'readwrite');
        transaction.objectStore('metadata').clear();
        transaction.objectStore('blobs').clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      }).catch(reject);
    });
  }

  private write(storeName: string, key: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.init().then(() => {
        if (!this.db) return resolve();
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        store.put(value, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      }).catch(reject);
    });
  }

  private read(storeName: string, key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.init().then(() => {
        if (!this.db) return resolve(null);
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      }).catch(reject);
    });
  }

  private delete(storeName: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.init().then(() => {
        if (!this.db) return resolve();
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        store.delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      }).catch(reject);
    });
  }
}

export const db = new WorkspaceDB();
