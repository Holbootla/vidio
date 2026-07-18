import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export const SYNC_DB_NAME = "vidio-sync";
export const SYNC_DB_VERSION = 1;

export interface SyncCursorRecord {
  profileId: string;
  sequence: number;
}

export interface QueuedMutationRecord {
  id: string;
  profileId: string;
  order: number;
  dedupeKey: string;
  mutation: OfflineMutationPayload;
  createdAt: string;
}

export type OfflineMutationPayload =
  | { type: "library_add"; body: import("@/lib/api/schemas").AddLibraryRequest }
  | { type: "library_remove"; mediaKey: string }
  | { type: "progress"; body: import("@/lib/api/schemas").ProgressRequest }
  | { type: "preferences"; body: import("@/lib/api/schemas").ProfilePreferences };

interface SyncDbSchema extends DBSchema {
  cursors: {
    key: string;
    value: SyncCursorRecord;
  };
  queue: {
    key: string;
    value: QueuedMutationRecord;
    indexes: {
      byProfileOrder: [string, number];
      byProfileDedupe: [string, string];
    };
  };
}

let dbPromise: Promise<IDBPDatabase<SyncDbSchema>> | null = null;
let dbInstance: IDBPDatabase<SyncDbSchema> | null = null;

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export function resetSyncDbForTests(): void {
  dbPromise = null;
  dbInstance = null;
}

export async function closeSyncDb(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  dbPromise = null;
}

export async function openSyncDb(): Promise<IDBPDatabase<SyncDbSchema>> {
  if (!isIndexedDbAvailable()) {
    throw new Error("IndexedDB is not available");
  }

  if (!dbPromise) {
    dbPromise = openDB<SyncDbSchema>(SYNC_DB_NAME, SYNC_DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains("cursors")) {
          database.createObjectStore("cursors", { keyPath: "profileId" });
        }
        if (!database.objectStoreNames.contains("queue")) {
          const store = database.createObjectStore("queue", { keyPath: "id" });
          store.createIndex("byProfileOrder", ["profileId", "order"]);
          store.createIndex("byProfileDedupe", ["profileId", "dedupeKey"]);
        }
      },
      blocked() {
        if (dbInstance) {
          dbInstance.close();
          dbInstance = null;
        }
        dbPromise = null;
      },
    }).then((db) => {
      dbInstance = db;
      return db;
    });
  }

  return dbPromise;
}

export async function deleteSyncDb(): Promise<void> {
  await closeSyncDb();
  if (!isIndexedDbAvailable()) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(SYNC_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Failed to delete sync database"));
    request.onblocked = () => resolve();
  });
}
