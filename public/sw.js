const CACHE_NAME = "ndjourney-v14";
const API_CACHE_NAME = "ndjourney-api-v15";
const IMAGE_CACHE_NAME = "ndjourney-images-v14";

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
const TILE_CDN_RE = /(^|\.)basemaps\.cartocdn\.com$|(^|\.)tile\.openstreetmap\.org$|^tiles\.openfreemap\.org$/i;

const PUBLIC_API_PATHS = [
  // SEC: /api/couple carries PII (birth dates) — never persist on-device.
  // Pages fall back to networkFirst (memory-only) + /offline.html when offline.
  "/api/games/questions",
];

// SEC: only unauthenticated page shells are persisted. Private routes and
// /letters/<id> must not be readable from disk after logout/offline.
const PUBLIC_PAGE_PATHS = new Set([
  "/",
  "/gallery",
  "/timeline",
  "/letters",
  "/games",
  "/notes",
  "/wishlist",
]);

const MAX_IMAGE_CACHE = 100;

// Location writes are owned by the page (durable IndexedDB outbox). A worker
// cannot know which user is signed in, so replaying a queue here could upload
// one account's location under another account's session.

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
    event.waitUntil(
      caches.keys().then((names) =>
        Promise.all(names.map((name) => caches.delete(name))),
      ),
    );
  }

  if (data?.type === "SKIP_WAITING") {
    self.skipWaiting();
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
    return;
  }

  if (CLOUDINARY_RE.test(url.hostname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE_NAME, MAX_IMAGE_CACHE));
    return;
  }

  // P-08: version polls must always hit network — a cached version.json blinds the updater.
  if (url.origin === location.origin && url.pathname === "/version.json") {
    return;
  }

  // SEC: the dashboard listing carries the answer key (`includeAnswer=1`) and
  // the single-question deep-link read under this path resolves to the same
  // data — never persist either on-device. Exact-path match also keeps the
  // per-type counts (and the deep-link read) out of the offline API cache.
  const isAnswerBearingQuestionRead =
    url.pathname === "/api/games/questions" &&
    url.searchParams.get("includeAnswer") === "1";

  if (
    url.origin === location.origin &&
    !isAnswerBearingQuestionRead &&
    PUBLIC_API_PATHS.some((p) => url.pathname === p)
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
    // SEC: never persist authed API JSON or private page HTML on-device.
    // Only allowlisted public API/page paths are written to disk.
    const reqUrl = new URL(request.url);
    const isPublicPage = reqUrl.origin === location.origin && PUBLIC_PAGE_PATHS.has(reqUrl.pathname);
    if (response.ok && response.type === "basic" && isPublicPage) {
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

// SEC: notification targets must resolve to this origin. Pattern-matching the
// raw string is not enough — WHATWG URL parsing normalizes backslash tricks
// ("/\evil.com" → "https://evil.com/"), so parse first, then compare origins.
// A pathname starting with "//" is rejected too, since re-resolving it as a
// relative URL would turn it proto-col-relative ("//evil.com").
function sameOriginPath(raw) {
  try {
    const u = new URL(raw ?? "/", self.location.origin);
    if (u.origin !== self.location.origin) return "/";
    if (u.pathname.startsWith("//")) return "/";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/";
  }
}

// SEC: same rule applied to an already-derived path, for callers that re-resolve
// it later (defense in depth).
function safePath(path) {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//")
    ? path
    : "/";
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    const parsed = event.data ? event.data.json() : {};
    // Payload may be null or a scalar — fall back to defaults, still show.
    if (parsed && typeof parsed === "object") data = parsed;
  } catch {
    /* absent/plaintext payload — show default notification */
  }
  const url = sameOriginPath(typeof data.url === "string" ? data.url : "/");
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Pasangan update", {
      body: data.body ?? "",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-48x48.png",
      data: { url: safePath(url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const url = sameOriginPath(event.notification.data?.url);
  event.notification.close();
  event.waitUntil(
    (async () => {
      // SEC: re-resolve and re-check — never navigate/open a foreign origin.
      let target = self.location.origin + "/";
      try {
        const parsed = new URL(url, self.location.origin);
        if (parsed.origin === self.location.origin && !parsed.pathname.startsWith("//")) {
          target = parsed.href;
        }
      } catch {
        /* keep origin root */
      }

      let handled = false;
      try {
        const clientsList = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        const hit = clientsList.find((c) => {
          try {
            return new URL(c.url).origin === self.location.origin;
          } catch {
            return false;
          }
        });
        if (hit) {
          try {
            await hit.focus();
          } catch {
            /* focus failed — still try to reuse the window */
          }
          try {
            if (hit.navigate) {
              await hit.navigate(target);
              handled = true;
            }
          } catch {
            /* navigate failed — fall back to openWindow below */
          }
        }
      } catch {
        /* matchAll failed — fall back to openWindow */
      }

      if (!handled) {
        try {
          if (self.clients.openWindow) await self.clients.openWindow(target);
        } catch {
          /* nothing else we can do */
        }
      }
    })(),
  );
});
