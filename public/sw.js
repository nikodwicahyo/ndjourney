const CACHE_NAME = "ndjourney-v8";
const API_CACHE_NAME = "ndjourney-api-v8";
const IMAGE_CACHE_NAME = "ndjourney-images-v8";

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

const PUBLIC_API_PATHS = [
  "/api/couple",
  "/api/games/questions",
];

const MAX_IMAGE_CACHE = 100;

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
  if (event.data?.type === "CLEAR_CACHES") {
    caches.keys().then((names) =>
      Promise.all(names.map((name) => caches.delete(name))),
    );
  }
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

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
