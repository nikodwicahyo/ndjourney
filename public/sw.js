const CACHE_NAME = "ndjourney-v9";
const API_CACHE_NAME = "ndjourney-api-v9";
const IMAGE_CACHE_NAME = "ndjourney-images-v9";

const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/offline.html",
  "/icons/icon.svg",
  "/icons/icon-48x48.png",
  "/icons/icon-72x72.png",
  "/icons/icon-96x96.png",
  "/icons/icon-128x128.png",
  "/icons/icon-144x144.png",
  "/icons/icon-152x152.png",
  "/icons/icon-192x192.png",
  "/icons/icon-384x384.png",
  "/icons/icon-512x512.png",
  "/favicon.svg",
];

const STATIC_EXT = /\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|woff2?)$/i;
const CLOUDINARY_RE = /res\.cloudinary\.com/;
const IMAGE_EXT = /\.(png|jpg|jpeg|gif|svg|webp|avif|ico)$/i;
const LOCATION_API_RE = /\/api\/location$/;
const TILE_CDN_RE = /\.basemaps\.cartocdn\.com|\.tile\.openstreetmap\.org$/i;

const PUBLIC_API_PATHS = [
  "/api/couple",
  "/api/games/questions",
];

const MAX_IMAGE_CACHE = 100;

// IndexedDB for location persistence
const DB_NAME = "ndjourney-location";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("lastPosition")) {
        db.createObjectStore("lastPosition", { keyPath: "id" });
      }
    };
  });
}

async function saveLastPosition(payload) {
  try {
    const db = await openDB();
    const tx = db.transaction("lastPosition", "readwrite");
    const store = tx.objectStore("lastPosition");
    store.put({ id: "current", ...payload });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("[SW] IndexedDB save failed:", e);
  }
}

async function getLastPosition() {
  try {
    const db = await openDB();
    const tx = db.transaction("lastPosition", "readonly");
    const store = tx.objectStore("lastPosition");
    return new Promise((resolve, reject) => {
      const req = store.get("current");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

// Queue for failed location POSTs
let locationQueue = [];

async function processLocationQueue() {
  if (locationQueue.length === 0) return;
  const queue = [...locationQueue];
  locationQueue = [];

  for (const payload of queue) {
    try {
      const res = await fetch("/api/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        // Re-queue only if not 403 (not sharing)
        if (res.status !== 403) {
          locationQueue.push(payload);
        }
      }
    } catch {
      locationQueue.push(payload);
    }
  }

  // If still queued items, retry in 30s
  if (locationQueue.length > 0) {
    setTimeout(processLocationQueue, 30000);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) =>
                name !== CACHE_NAME &&
                name !== API_CACHE_NAME &&
                name !== IMAGE_CACHE_NAME,
            )
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;

  if (data?.type === "CLEAR_CACHES") {
    caches.keys().then((names) =>
      Promise.all(names.map((name) => caches.delete(name))),
    );
  }

  if (data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (data?.type === "SET_LAST_POSITION" && data.payload) {
    saveLastPosition(data.payload);
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-http(s) requests (e.g., chrome-extension://)
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Skip map tile CDN requests — loaded as <img> under img-src, bypass SW connect-src CSP
  if (TILE_CDN_RE.test(url.hostname)) return;

  if (request.method !== "GET") {
    // For POST to /api/location, attempt to queue if offline
    if (
      request.method === "POST" &&
      url.origin === location.origin &&
      LOCATION_API_RE.test(url.pathname)
    ) {
      event.respondWith(
        (async () => {
          try {
            // Try network first
            const response = await fetch(request);
            return response;
          } catch {
            // Queue for retry and return a placeholder response
            request.clone().json().then((body) => {
              locationQueue.push(body);
              setTimeout(processLocationQueue, 5000);
            }).catch(() => {});
            return new Response(
              JSON.stringify({ data: { ok: true } }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }
        })(),
      );
      return;
    }
    return;
  }

  if (CLOUDINARY_RE.test(url.hostname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE_NAME, MAX_IMAGE_CACHE));
    return;
  }

  if (
    url.origin === location.origin &&
    PUBLIC_API_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(p + "/"))
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (
    url.origin === location.origin &&
    STATIC_EXT.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  if (
    url.origin === location.origin &&
    IMAGE_EXT.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE_NAME));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function cacheFirst(request, cacheName = CACHE_NAME, maxItems = 0) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      const clone = response.clone();
      const cache = await caches.open(cacheName);
      cache.put(request, clone);
    } else if (response.ok && response.type === "opaque") {
      const clone = response.clone();
      const cache = await caches.open(cacheName);
      cache.put(request, clone);
    }
    return response;
  } catch {
    if (request.mode === "navigate") {
      return caches.match("/offline.html");
    }
    return new Response("", { status: 408, statusText: "Offline" });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok && response.type === "basic") {
        const clone = response.clone();
        cache.put(request, clone);
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      const clone = response.clone();
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, clone);
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      return caches.match("/offline.html");
    }
    return new Response("Offline", { status: 503 });
  }
}
