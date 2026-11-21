import {
  MAX_OUTBOX_AGE_MS,
  MAX_OUTBOX_POINTS,
  type LocationFix,
} from "./location";

export type OutboxFix = LocationFix & {
  id: string;
  userId: string;
  /** Local wall clock when queued — independent of the device GPS clock. */
  enqueuedAt: number;
};

const DB_NAME = "ndjourney-location";
const DB_VERSION = 2;
const STORE = "outbox";

let dbPromise: Promise<IDBDatabase | null> | null = null;
let idCounter = 0;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      dbPromise = null;
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("userId", "userId");
      }
      // The old service worker stored a single last position here; the page
      // owns the durable outbox now.
      if (db.objectStoreNames.contains("lastPosition")) {
        db.deleteObjectStore("lastPosition");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { dbPromise = null; resolve(null); };
    request.onblocked = () => { dbPromise = null; resolve(null); };
  });

  return dbPromise;
}

/** Resolves true only when the transaction actually committed. */
function requestDone(tx: IDBTransaction): Promise<boolean> {
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
}

function fixId(userId: string, fix: LocationFix): string {
  // A counter avoids collisions when two fixes share a millisecond and the
  // same rounded coordinates.
  return `${userId}:${Date.now()}:${idCounter++}:${fix.recordedAt}:${fix.latitude.toFixed(5)}:${fix.longitude.toFixed(5)}`;
}

/** Returns false when storage is unavailable, so the caller can show a status. */
export async function enqueueFix(userId: string, fix: LocationFix): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;

  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({
      id: fixId(userId, fix),
      userId,
      enqueuedAt: Date.now(),
      ...fix,
    } satisfies OutboxFix);
    if (!(await requestDone(tx))) return false;
    await trim(userId);
    return true;
  } catch {
    return false;
  }
}

export async function peekFixes(userId: string, limit = 100): Promise<OutboxFix[]> {
  const db = await openDb();
  if (!db) return [];

  try {
    const tx = db.transaction(STORE, "readonly");
    const index = tx.objectStore(STORE).index("userId");
    const rows = await new Promise<OutboxFix[]>((resolve) => {
      const req = index.getAll(userId);
      req.onsuccess = () => resolve((req.result ?? []) as OutboxFix[]);
      req.onerror = () => resolve([]);
    });
    return rows.sort((a, b) => a.recordedAt - b.recordedAt).slice(0, limit);
  } catch {
    return [];
  }
}

/** Returns false when deletion failed; rows must not be treated as delivered. */
export async function removeFixes(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const db = await openDb();
  if (!db) return false;

  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const id of ids) store.delete(id);
    return await requestDone(tx);
  } catch {
    return false;
  }
}

/**
 * Location is sensitive. A queue written by a previous account must never be
 * uploaded under the next account's session on a shared device.
 */
export async function clearUser(userId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;

  try {
    const tx = db.transaction(STORE, "readwrite");
    const index = tx.objectStore(STORE).index("userId");
    const cursorReq = index.openCursor(userId);
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
    await requestDone(tx);
  } catch {
    /* best effort */
  }
}

export async function purgeOtherUsers(userId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;

  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      const record = cursor.value as OutboxFix;
      if (record.userId !== userId) cursor.delete();
      cursor.continue();
    };
    await requestDone(tx);
  } catch {
    /* best effort */
  }
}

async function trim(userId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;

  try {
    const tx = db.transaction(STORE, "readwrite");
    const index = tx.objectStore(STORE).index("userId");
    const rows = await new Promise<OutboxFix[]>((resolve) => {
      const req = index.getAll(userId);
      req.onsuccess = () => resolve((req.result ?? []) as OutboxFix[]);
      req.onerror = () => resolve([]);
    });

    // Age by local enqueue time: a device clock days behind must not cause
    // fresh fixes to be trimmed the moment they are queued.
    const cutoff = Date.now() - MAX_OUTBOX_AGE_MS;
    const sorted = rows.sort((a, b) => (a.enqueuedAt ?? a.recordedAt) - (b.enqueuedAt ?? b.recordedAt));
    const excess = Math.max(0, sorted.length - MAX_OUTBOX_POINTS);
    const store = tx.objectStore(STORE);

    sorted.forEach((row, index) => {
      const age = row.enqueuedAt ?? row.recordedAt;
      if (index < excess || age < cutoff) store.delete(row.id);
    });
    await requestDone(tx);
  } catch {
    /* best effort */
  }
}
