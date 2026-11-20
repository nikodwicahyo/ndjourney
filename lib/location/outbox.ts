import type { LocationFix, QueuedFix } from "./types";

const DEFAULT_DB = "ndjourney-location";
const STORE = "outbox";
const DB_VERSION = 1;

/** Enough for ~4 hours of offline movement at one fix every 30 s. */
export const MAX_QUEUE = 500;

export interface Outbox {
  enqueue(fix: LocationFix): Promise<void>;
  list(limit?: number): Promise<LocationFix[]>;
  remove(clientIds: string[]): Promise<void>;
  count(): Promise<number>;
  clear(): Promise<void>;
}

export type OutboxOptions = { dbName?: string; maxItems?: number };

// Monotonic within the page: two fixes queued in the same millisecond still
// keep insertion order, which is what the flush and the trail rely on.
let lastQueuedAt = 0;
function nextQueuedAt(): number {
  const now = Date.now();
  lastQueuedAt = now > lastQueuedAt ? now : lastQueuedAt + 1;
  return lastQueuedAt;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function openDb(name: string): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(name, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "clientId" });
        os.createIndex("queuedAt", "queuedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

function idbOutbox(conn: IDBDatabase, maxItems: number): Outbox {
  const store = (mode: IDBTransactionMode) =>
    conn.transaction(STORE, mode).objectStore(STORE);

  async function trim(): Promise<void> {
    const total = await request(store("readonly").count());
    if (total <= maxItems) return;
    const all = (await request(store("readonly").getAll())) as QueuedFix[];
    all.sort((a, b) => a.queuedAt - b.queuedAt);
    const excess = all.slice(0, total - maxItems);
    if (excess.length === 0) return;
    const tx = conn.transaction(STORE, "readwrite");
    const os = tx.objectStore(STORE);
    for (const rec of excess) os.delete(rec.clientId);
    await transactionDone(tx);
  }

  return {
    async enqueue(fix) {
      await request(store("readwrite").put({ ...fix, queuedAt: nextQueuedAt() }));
      await trim();
    },

    async list(limit) {
      const all = (await request(store("readonly").getAll())) as QueuedFix[];
      all.sort((a, b) => a.queuedAt - b.queuedAt);
      const sliced = typeof limit === "number" ? all.slice(0, limit) : all;
      // Strip the bookkeeping field so callers see exactly LocationFix.
      return sliced.map(({ queuedAt: _queuedAt, ...fix }) => fix);
    },

    async remove(clientIds) {
      if (clientIds.length === 0) return;
      const tx = conn.transaction(STORE, "readwrite");
      const os = tx.objectStore(STORE);
      for (const id of clientIds) os.delete(id);
      await transactionDone(tx);
    },

    async count() {
      return request(store("readonly").count());
    },

    async clear() {
      await request(store("readwrite").clear());
    },
  };
}

/** In-memory queue: used when IndexedDB is blocked (private mode) or absent. */
export function createMemoryOutbox(maxItems = MAX_QUEUE): Outbox {
  const items = new Map<string, QueuedFix>();

  function trim(): void {
    while (items.size > maxItems) {
      const oldest = items.keys().next().value;
      if (oldest === undefined) return;
      items.delete(oldest);
    }
  }

  return {
    async enqueue(fix) {
      items.delete(fix.clientId);
      items.set(fix.clientId, { ...fix, queuedAt: nextQueuedAt() });
      trim();
    },
    async list(limit) {
      const all = [...items.values()].sort((a, b) => a.queuedAt - b.queuedAt);
      const sliced = typeof limit === "number" ? all.slice(0, limit) : all;
      return sliced.map(({ queuedAt: _queuedAt, ...fix }) => fix);
    },
    async remove(clientIds) {
      for (const id of clientIds) items.delete(id);
    },
    async count() {
      return items.size;
    },
    async clear() {
      items.clear();
    },
  };
}

/**
 * IndexedDB-backed write-ahead queue with a memory fallback.
 *
 * ponytail: the backend is chosen once per session. If IndexedDB opens and then
 * fails later, fixes degrade to the memory queue instead of retrying the open —
 * upgrade to a per-operation retry only if a real device shows that failure.
 */
export function createOutbox(options: OutboxOptions = {}): Outbox {
  const dbName = options.dbName ?? DEFAULT_DB;
  const maxItems = options.maxItems ?? MAX_QUEUE;
  const memory = createMemoryOutbox(maxItems);

  let backend: Promise<Outbox> | null = null;
  const get = (): Promise<Outbox> => {
    backend ??= (async () => {
      try {
        const conn = await openDb(dbName);
        return conn ? idbOutbox(conn, maxItems) : memory;
      } catch {
        return memory;
      }
    })();
    return backend;
  };

  return {
    enqueue: async (fix) => (await get()).enqueue(fix),
    list: async (limit) => (await get()).list(limit),
    remove: async (ids) => (await get()).remove(ids),
    count: async () => (await get()).count(),
    clear: async () => (await get()).clear(),
  };
}

/** The app-wide queue. One per browser/profile, survives reloads. */
export const outbox: Outbox = createOutbox();
