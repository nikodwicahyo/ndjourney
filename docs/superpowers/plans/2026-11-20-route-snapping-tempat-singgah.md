# Route Snapping Everywhere + Tempat Singgah Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Mengikuti Jalan / Garis Lurus route option a first-class, always-visible map setting that bends both the live partner distance line and the history trail by default, and make Tempat Singgah accurate, named, and properly shown on the map — hardened end-to-end.

**Architecture:** Thin authenticated Next.js API proxies for OSRM (routing) and Nominatim (reverse geocode) with validation, in-memory LRU cache, timeout, and fail-soft fallback; a client `lib/routing.ts` layer consumes them. Stop detection is rewritten as a median-centroid dwell clustering algorithm. Components consume a single `useRoadRoute` query and a `usePlaceNames` hook; all Leaflet-injected user strings go through one `escapeHtml`.

**Tech Stack:** Next.js 16 App Router, React 19, TanStack Query v5, Leaflet 1.9, Prisma, Vitest + Testing Library, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-11-20-route-snapping-tempat-singgah-design.md`

## Global Constraints

- All third-party HTTP (OSRM, Nominatim) happens **server-side only**; the browser calls same-origin `/api/*` routes.
- Every proxy is authenticated (`auth()`), validates query params, caches, times out, and **never throws to the client** — it returns a fallback payload with HTTP 200.
- Every user-controlled string placed into Leaflet HTML (tooltips, popups, `aria-label`, `divIcon`) goes through `escapeHtml`.
- Indonesian UI copy stays Indonesian; time formatting stays `Asia/Jakarta` (`formatTimeOnly`).
- Do not change the Prisma schema. Do not add dependencies.
- Tests: `npx vitest run tests/unit/<file>` for single files; `npm run test:unit`, `npm run test:integration`, `npm run lint`, `npm run typecheck`, `npm run build` for gates.

## Review Focus

- **Partner display name containing quotes/HTML** — must render literally, never inject markup (XSS). Pinned by Task 6 manual checklist + `escape-html` unit tests.
- **OSRM or Nominatim down / slow / rate-limited** — map still draws (straight line, no name), no uncaught rejection, no UI freeze. Pinned by Task 1 (fallback payloads) and Task 2 (client fallback) tests.
- **Identical or near-identical endpoints** (distance ≈ 0) — no OSRM call, no divide-by-zero, no NaN label. Pinned by Task 2.
- **GPS drift / low-accuracy fixes** — must not split one visit into several stops. Pinned by Task 4.
- **Long gaps / brief pass-throughs** — a 40-minute silence must not merge two visits; a 1-minute drive-through must not create a stop. Pinned by Task 4.
- **2000-point history** — layer rebuild and OSRM calls must not run on every 15s poll. Pinned by Task 6 (re-key) + manual perf checklist.
- **Reduced motion / small screens** — route toggle and stop list stay usable; existing reduced-motion handling is preserved. Pinned by Task 9 manual checklist.

---

### Task 1: Server proxies for OSRM + Nominatim (+ CSP cleanup)

**Files:**
- Create: `app/api/route/route.ts`
- Create: `app/api/geocode/reverse/route.ts`
- Modify: `lib/csp.ts` (remove `https://nominatim.openstreetmap.org` from `connect-src`)
- Modify: `vercel.json` (regenerate with `npm run sync:csp`)
- Modify: `tests/integration/api-authz-matrix.test.ts` (import both routes, add 2 cases)
- Test: `tests/unit/routing-api.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/route?from=lat,lng&to=lat,lng` → `200 { data: { distanceMeters: number, durationSeconds: number | null, geometry: Array<[number, number]> | null, source: "osrm" | "fallback" } }`; `400` invalid coords; `401` anonymous.
  - `GET /api/geocode/reverse?lat=&lng=` → `200 { data: { name: string | null } }`; `400` invalid coords; `401` anonymous.

- [ ] **Step 1: Write the failing tests** in `tests/unit/routing-api.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "u1" } })) }));

const route = await import("@/app/api/route/route");
const geocode = await import("@/app/api/geocode/reverse/route");

const req = (url: string) => new Request(`http://localhost${url}`);

describe("GET /api/route", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("maps an OSRM response to Leaflet coordinates and caches it", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        code: "Ok",
        routes: [{ distance: 1234.5, duration: 567.8, geometry: { coordinates: [[106.81, -6.2], [106.82, -6.21]] } }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await route.GET(req("/api/route?from=-6.2,106.81&to=-6.21,106.82"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.geometry).toEqual([[-6.2, 106.81], [-6.21, 106.82]]);
    expect(json.data.distanceMeters).toBe(1234.5);
    expect(json.data.durationSeconds).toBe(567.8);
    expect(json.data.source).toBe("osrm");

    await route.GET(req("/api/route?from=-6.2,106.81&to=-6.21,106.82"));
    expect(fetchMock).toHaveBeenCalledTimes(1); // second call served from cache
  });

  it("falls back to straight-line data when OSRM fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    const res = await route.GET(req("/api/route?from=-6.3,106.9&to=-6.31,106.91"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.geometry).toBeNull();
    expect(json.data.durationSeconds).toBeNull();
    expect(json.data.distanceMeters).toBeGreaterThan(1000);
    expect(json.data.source).toBe("fallback");
  });

  it("rejects invalid coordinates with 400", async () => {
    const res = await route.GET(req("/api/route?from=999,106.8&to=-6.2,106.8"));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/geocode/reverse", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("returns the best address name", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ address: { road: "Jl. Sudirman", suburb: "Menteng" }, display_name: "Jl. Sudirman, Menteng, Jakarta" }),
    })));
    const res = await geocode.GET(req("/api/geocode/reverse?lat=-6.2&lng=106.81"));
    expect(res.status).toBe(200);
    expect((await res.json()).data.name).toBe("Jl. Sudirman");
  });

  it("returns name null when the upstream fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    const res = await geocode.GET(req("/api/geocode/reverse?lat=-6.21&lng=106.82"));
    expect(res.status).toBe(200);
    expect((await res.json()).data.name).toBeNull();
  });
});
```

Note: use a **distinct coordinate pair per test** — caches are module-level and persist across tests in a file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/routing-api.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `app/api/route/route.ts`**

- `export const dynamic = "force-dynamic";`
- `GET(request?: Request)`: `auth()` first (401 if no `session?.user`).
- Parse `from` and `to` with `new URL(request.url).searchParams`; split on `,`; require two finite numbers each; `lat ∈ [-90, 90]`, `lng ∈ [-180, 180]`; else `400 { error: "Parameter tidak valid" }`.
- Module-level `Map<string, RoutePayload>` cache (max 200, delete oldest key), key = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}|${to.lat.toFixed(4)},${to.lng.toFixed(4)}`.
- Cache hit → return cached.
- Otherwise fetch `https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson` with `signal: AbortSignal.timeout(4000)` and header `Accept: application/json`.
- On `code === "Ok"` with `routes[0].geometry.coordinates`: map `[lng, lat] → [lat, lng]`, `distanceMeters = routes[0].distance`, `durationSeconds = routes[0].duration`, `source: "osrm"`. Cache it.
- Any other outcome (non-OK, `!res.ok`, throw, timeout): `source: "fallback"`, `geometry: null`, `durationSeconds: null`, `distanceMeters = haversineMeters({ latitude: fromLat, longitude: fromLng }, { latitude: toLat, longitude: toLng })` (import from `@/lib/geo`). Cache it too.
- Respond `{ data: payload }` with header `"Cache-Control": "private, max-age=60"`.

- [ ] **Step 4: Implement `app/api/geocode/reverse/route.ts`**

- `export const dynamic = "force-dynamic";`
- `GET(request: Request)`: `auth()` first (401).
- Parse `lat`, `lng` (single numbers, same range checks); else 400.
- Module-level `Map<string, string | null>` cache (max 500), key = 4-dp rounded.
- Fetch `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&accept-language=id` with headers `{ "User-Agent": "NdJourney/1.0 (https://ndjourney.vercel.app)", "Accept-Language": "id" }` and `signal: AbortSignal.timeout(3000)`.
- Name priority: `address.road || address.suburb || address.quarter || address.city_district || display_name.split(",")[0]`.
- Upstream failure → `name: null` (cached).
- Respond `{ data: { name } }` with `"Cache-Control": "private, max-age=3600"`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/routing-api.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Add both routes to the authz matrix**

In `tests/integration/api-authz-matrix.test.ts`: add
`const routeProxy = await import("@/app/api/route/route");` and
`const geocodeProxy = await import("@/app/api/geocode/reverse/route");`
plus cases `["GET /api/route", () => routeProxy.GET(req("/api/route?from=-6.2,106.8&to=-6.21,106.81"))]` and
`["GET /api/geocode/reverse", () => geocodeProxy.GET(req("/api/geocode/reverse?lat=-6.2&lng=106.8"))]`.

- [ ] **Step 7: Run the matrix + CSP cleanup**

Run: `npx vitest run tests/integration/api-authz-matrix.test.ts` → PASS.
Edit `lib/csp.ts`: drop ` https://nominatim.openstreetmap.org` from the `connect-src` directive.
Run: `npm run sync:csp` → `vercel.json` matches `lib/csp.ts`.

- [ ] **Step 8: Commit**

```bash
git add app/api/route app/api/geocode/reverse lib/csp.ts vercel.json tests/unit/routing-api.test.ts tests/integration/api-authz-matrix.test.ts
git commit -m "feat(location): proxy OSRM routing and Nominatim geocoding through the API"
```

---

### Task 2: Client routing lib + shared HTML escaper

**Files:**
- Create: `lib/routing.ts`
- Create: `lib/escape-html.ts`
- Test: `tests/unit/routing.test.ts`
- Test: `tests/unit/escape-html.test.ts`

**Interfaces:**
- Produces:
  - `type LatLng = { lat: number; lng: number }`
  - `type RoadRoute = { distanceMeters: number; durationSeconds: number | null; geometry: Array<[number, number]> | null; source: "osrm" | "fallback" }`
  - `fetchRoadRoute(from: LatLng, to: LatLng, opts?: { signal?: AbortSignal }): Promise<RoadRoute>`
  - `reverseGeocodeName(lat: number, lng: number, opts?: { signal?: AbortSignal }): Promise<string | null>`
  - `escapeHtml(value: string): string`

- [ ] **Step 1: Write the failing tests**

`tests/unit/routing.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchRoadRoute, reverseGeocodeName } from "@/lib/routing";
import { haversineMeters } from "@/lib/geo";

const a = { lat: -6.2, lng: 106.81 };
const b = { lat: -6.21, lng: 106.82 };
const c = { lat: -6.4, lng: 106.95 };
const d = { lat: -6.41, lng: 106.96 };

const hav = (p: { lat: number; lng: number }, q: { lat: number; lng: number }) =>
  haversineMeters({ latitude: p.lat, longitude: p.lng }, { latitude: q.lat, longitude: q.lng });

describe("fetchRoadRoute", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("returns the proxy payload on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { distanceMeters: 1234, durationSeconds: 567, geometry: [[-6.2, 106.81], [-6.21, 106.82]], source: "osrm" } }),
    })));
    const res = await fetchRoadRoute(a, b);
    expect(res.geometry).toEqual([[-6.2, 106.81], [-6.21, 106.82]]);
    expect(res.distanceMeters).toBe(1234);
    expect(res.durationSeconds).toBe(567);
  });

  it("caches by rounded coordinates", async () => {
    const mock = vi.fn(async () => ({ ok: true, json: async () => ({ data: { distanceMeters: 1, durationSeconds: 1, geometry: [[-6.3, 106.9], [-6.31, 106.91]], source: "osrm" } }) }));
    vi.stubGlobal("fetch", mock);
    await fetchRoadRoute({ lat: -6.3, lng: 106.9 }, { lat: -6.31, lng: 106.91 });
    await fetchRoadRoute({ lat: -6.3, lng: 106.9 }, { lat: -6.31, lng: 106.91 });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("falls back to straight-line distance when the API fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    const res = await fetchRoadRoute(c, d);
    expect(res.geometry).toBeNull();
    expect(res.source).toBe("fallback");
    expect(res.distanceMeters).toBeCloseTo(hav(c, d), 3);
  });

  it("does not call the API for identical points", async () => {
    const mock = vi.fn(async () => ({}));
    vi.stubGlobal("fetch", mock);
    const res = await fetchRoadRoute(a, { ...a });
    expect(mock).not.toHaveBeenCalled();
    expect(res.distanceMeters).toBe(0);
    expect(res.geometry).toEqual([[a.lat, a.lng]]);
  });
});

describe("reverseGeocodeName", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("returns the name on success and caches it", async () => {
    const mock = vi.fn(async () => ({ ok: true, json: async () => ({ data: { name: "Jl. Sudirman" } }) }));
    vi.stubGlobal("fetch", mock);
    await expect(reverseGeocodeName(-6.2, 106.81)).resolves.toBe("Jl. Sudirman");
    await expect(reverseGeocodeName(-6.2, 106.81)).resolves.toBe("Jl. Sudirman");
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("returns null when the API fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    await expect(reverseGeocodeName(-6.21, 106.82)).resolves.toBeNull();
  });
});
```

`tests/unit/escape-html.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { escapeHtml } from "@/lib/escape-html";

describe("escapeHtml", () => {
  it("escapes markup characters", () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
  });
  it("escapes ampersands and single quotes", () => {
    expect(escapeHtml(`Tom & Jerry's`)).toBe("Tom &amp; Jerry&#39;s");
  });
  it("leaves plain text untouched", () => {
    expect(escapeHtml("Jl. Sudirman")).toBe("Jl. Sudirman");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/routing.test.ts tests/unit/escape-html.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `lib/escape-html.ts`**

```ts
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}
```

- [ ] **Step 4: Implement `lib/routing.ts`**

- Module-level LRU caches: `routeCache` (max 100), `geocodeCache` (max 300); key = 4-dp rounded coords.
- `fetchRoadRoute`: identical points (haversine < 1 m) → `{ distanceMeters: 0, durationSeconds: 0, geometry: [[from.lat, from.lng]], source: "fallback" }` without fetching.
- Cache hit → return. Else `fetch(\`/api/route?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}\`, { signal: opts?.signal })`; on `res.ok` read `json.data`, normalize `geometry` to `Array<[number, number]> | null`, cache, return.
- On any error → `{ distanceMeters: haversineMeters({ latitude: from.lat, longitude: from.lng }, { latitude: to.lat, longitude: to.lng }), durationSeconds: null, geometry: null, source: "fallback" }` (not cached).
- `reverseGeocodeName`: cache hit (including `null`) → return; else `fetch(\`/api/geocode/reverse?lat=${lat}&lng=${lng}\`, { signal })`; `res.ok` → `json.data.name ?? null`; error → `null`; cache and return.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/routing.test.ts tests/unit/escape-html.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/routing.ts lib/escape-html.ts tests/unit/routing.test.ts tests/unit/escape-html.test.ts
git commit -m "feat(location): add client routing/geocode wrappers and shared HTML escaper"
```

---

### Task 3: Road-distance ETA helper

**Files:**
- Modify: `lib/geo.ts`
- Test: `tests/unit/geo-road-eta.test.ts`

**Interfaces:**
- Produces: `estimateArrivalFromRoadDistance(roadDistanceMeters: number, mode?: TravelMode): number` (seconds, rounded; `0` for non-positive/NaN input).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { estimateArrivalFromRoadDistance } from "@/lib/geo";

afterEach(() => vi.useRealTimers());

describe("estimateArrivalFromRoadDistance", () => {
  it("walks at WALKING_SPEED_MS", () => {
    expect(estimateArrivalFromRoadDistance(5000, "walking")).toBe(Math.round(5000 / 1.4));
  });

  it("cycles at CYCLING_SPEED_MS", () => {
    expect(estimateArrivalFromRoadDistance(5000, "cycling")).toBe(Math.round(5000 / 8.3));
  });

  it("applies the traffic multiplier for driving", () => {
    vi.setSystemTime(new Date("2026-11-20T02:00:00Z")); // 09:00 Jakarta -> 0.85
    expect(estimateArrivalFromRoadDistance(10000, "driving")).toBe(Math.round(10000 / (11.1 * 0.85)));
  });

  it("returns 0 for zero or invalid input", () => {
    expect(estimateArrivalFromRoadDistance(0)).toBe(0);
    expect(estimateArrivalFromRoadDistance(Number.NaN)).toBe(0);
    expect(estimateArrivalFromRoadDistance(-5)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/geo-road-eta.test.ts`
Expected: FAIL — export missing.

- [ ] **Step 3: Implement in `lib/geo.ts`**

Add an internal helper and refactor `estimateArrivalSeconds` to share it:

```ts
function travelTimeSeconds(distanceMeters: number, mode: TravelMode, applyRoadFactor: boolean): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return 0;
  const rd = applyRoadFactor ? distanceMeters * roadFactor(distanceMeters) : distanceMeters;
  const base =
    mode === "cycling" ? CYCLING_SPEED_MS
    : mode === "driving" ? DRIVING_SPEED_MS
    : WALKING_SPEED_MS;
  const speed = mode === "driving" ? base * trafficMultiplier() : base;
  return Math.round(rd / speed);
}

export function estimateArrivalSeconds(distanceMeters: number, mode: TravelMode = "walking"): number {
  return travelTimeSeconds(distanceMeters, mode, true);
}

export function estimateArrivalFromRoadDistance(roadDistanceMeters: number, mode: TravelMode = "walking"): number {
  return travelTimeSeconds(roadDistanceMeters, mode, false);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/geo-road-eta.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/geo.ts tests/unit/geo-road-eta.test.ts
git commit -m "feat(location): add road-distance ETA estimate"
```

---

### Task 4: Accurate Tempat Singgah detection + proxy-backed route fetch

**Files:**
- Modify: `lib/location-history.ts`
- Test: `tests/unit/location-history.test.ts` (extend + update)

**Interfaces:**
- Produces:
  - `detectStopPoints(rawPoints, options?: { clusterRadiusMeters?, minDwellMinutes?, maxAccuracyMeters?, minStationaryPings?, maxGapMinutes?, mergeRadiusMeters? }): VisitedStop[]` — defaults `50, 3, 80, 3, 15, 50`.
  - `fetchRoadSnappedRoute(points, options?): Promise<Array<[number, number]>>` — unchanged signature, now proxy-backed.

- [ ] **Step 1: Write the failing tests** (append to `tests/unit/location-history.test.ts`)

```ts
describe("detectStopPoints (accuracy)", () => {
  const baseTime = new Date("2026-11-20T10:00:00Z").getTime();
  const at = (mins: number, lat: number, lng: number, accuracy: number | null, speed: number | null) => ({
    userId: "u1", latitude: lat, longitude: lng, accuracy, heading: null, speed,
    createdAt: new Date(baseTime + mins * 60000).toISOString(), deviceType: "mobile",
  });

  it("ignores low-accuracy fixes when clustering", () => {
    const points = [
      at(0, -6.2, 106.816, 10, 0.2),
      at(5, -6.2001, 106.8161, 500, 0.1), // drift fix, must be dropped
      at(10, -6.2, 106.816, 12, 0),
      at(20, -6.218, 106.83, 10, 12.5),
      at(60, -6.23, 106.84, 10, 0.1),
    ];
    const stops = detectStopPoints(points);
    expect(stops).toHaveLength(2);
    expect(stops[0].pointCount).toBe(2); // drift point excluded
  });

  it("splits one place into two stops across a long silence", () => {
    const points = [
      at(0, -6.2, 106.816, 10, 0.1),
      at(10, -6.2, 106.816, 10, 0),
      at(60, -6.2, 106.816, 10, 0.1),
      at(70, -6.2, 106.816, 10, 0),
    ];
    const stops = detectStopPoints(points);
    expect(stops).toHaveLength(2);
  });

  it("does not create a stop for a brief drive-through", () => {
    const points = [
      at(0, -6.2, 106.816, 10, 8),
      at(1, -6.2003, 106.8163, 10, 9),
      at(30, -6.23, 106.84, 10, 0.1),
      at(40, -6.2301, 106.8401, 10, 0),
    ];
    const stops = detectStopPoints(points);
    expect(stops).toHaveLength(1); // only the office, which is the current stop
    expect(stops[0].pointCount).toBe(2);
  });

  it("merges clusters split by a drift jump", () => {
    const points = [
      at(0, -6.2, 106.816, 10, 0.1),
      at(5, -6.2, 106.816, 10, 0),
      at(6, -6.2006, 106.8166, 10, 0.4), // ~94m jump -> own cluster
      at(10, -6.2, 106.816, 10, 0), // back near the first cluster
    ];
    const stops = detectStopPoints(points);
    expect(stops).toHaveLength(1);
    expect(stops[0].pointCount).toBe(3); // the 1-minute jump cluster is dropped
    expect(stops[0].isCurrent).toBe(true);
  });
});
```

Also **replace** the existing `fetchRoadSnappedRoute` tests (both) with — note the two tests must use **different coordinates**, because `lib/routing`'s client cache is module-level and shared within the file:

```ts
it("falls back to waypoints on fetch error", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network fail"));
  const pts = [{ lat: -6.25, lng: 106.85 }, { lat: -6.26, lng: 106.86 }];
  const res = await fetchRoadSnappedRoute(pts, { timeoutMs: 1000 });
  expect(res).toEqual([[-6.25, 106.85], [-6.26, 106.86]]);
});

it("maps the proxy payload to Leaflet coordinates", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      data: { distanceMeters: 1234, durationSeconds: 60, geometry: [[-6.2, 106.81], [-6.205, 106.815], [-6.21, 106.82]] },
    }),
  } as Response);
  const res = await fetchRoadSnappedRoute([{ lat: -6.2, lng: 106.81 }, { lat: -6.21, lng: 106.82 }]);
  expect(res).toEqual([[-6.2, 106.81], [-6.205, 106.815], [-6.21, 106.82]]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/location-history.test.ts`
Expected: FAIL on the new accuracy cases and the proxy test.

- [ ] **Step 3: Implement `detectStopPoints` in `lib/location-history.ts`**

Algorithm (defaults in parentheses):
1. Drop points whose `accuracy` is non-null and `> maxAccuracyMeters` (80).
2. Sort by `createdAt` ascending. Empty → `[]`.
3. Single pass clustering: start a cluster with `points[0]`; for each next point compute the cluster **median** center (`medianLat`, `medianLng` of current cluster) and the gap since the cluster's last point. Join when `haversineMeters(medianCenter, pt) <= clusterRadiusMeters` (50) **and** `gap <= maxGapMinutes * 60000` (15); else close the cluster and start a new one.
4. Finalize each cluster: `dwellMin = (last - first) / 60000`; `stationary = count(p.speed !== null && p.speed < 1.0)`; qualifies when `isFinalCluster || dwellMin >= minDwellMinutes (3) || stationary >= minStationaryPings (3)`.
5. Centroid = median lat/lng; `id = \`stop-${userId}-${stops.length + 1}-${startTime}\``; keep `arrivedAt`, `departedAt`, `durationMinutes` (rounded, min 1), `pointCount`, `isCurrent` (final cluster only).
6. Merge pass: consecutive stops whose centroids are `<= mergeRadiusMeters` (50) apart merge into the earlier one — `arrivedAt` from the earlier, `departedAt` from the later, `durationMinutes` recomputed from those two timestamps, `pointCount` summed, centroid = pointCount-weighted average, `isCurrent` from the later.

- [ ] **Step 4: Route `fetchRoadSnappedRoute` through the proxy**

Delete `ROAD_ROUTE_CACHE` / `MAX_ROAD_CACHE` from `lib/location-history.ts`. New body:

```ts
export async function fetchRoadSnappedRoute(
  points: Array<{ lat: number; lng: number }>,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<Array<[number, number]>> {
  if (points.length < 2) return points.map((p) => [p.lat, p.lng]);
  const first = points[0];
  const last = points[points.length - 1];
  const route = await fetchRoadRoute(first, last, { signal: options.signal });
  if (route.geometry && route.geometry.length >= 2) return route.geometry;
  return downsampleWaypoints(points).map((p) => [p.lat, p.lng]);
}
```

(`timeoutMs` is accepted for signature compatibility and otherwise ignored — the API enforces its own 4s timeout.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/location-history.test.ts`
Expected: PASS (all cases, including the two pre-existing ones).

- [ ] **Step 6: Commit**

```bash
git add lib/location-history.ts tests/unit/location-history.test.ts
git commit -m "feat(location): accuracy-aware stop detection and proxy-backed route snapping"
```

---

### Task 5: Hooks — history gating, road route query, place names

**Files:**
- Modify: `hooks/useLocation.ts`
- Test: `tests/unit/place-names.test.tsx`

**Interfaces:**
- Consumes: `fetchRoadRoute`, `reverseGeocodeName`, `LatLng` from `@/lib/routing` (Task 2); `VisitedStop` from `@/lib/location-history` (Task 4).
- Produces:
  - `useLocationHistory(range?: string, options?: { enabled?: boolean })` — `enabled` defaults to `true`.
  - `useRoadRoute(from: LatLng | null, to: LatLng | null, enabled: boolean): UseQueryResult<RoadRoute>`
  - `usePlaceNames(stops: VisitedStop[]): Record<string, string | null>`

- [ ] **Step 1: Write the failing test** `tests/unit/place-names.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/lib/routing", () => ({
  fetchRoadRoute: vi.fn(),
  reverseGeocodeName: vi.fn(async () => "Kafe"),
}));

import { usePlaceNames } from "@/hooks/useLocation";
import type { VisitedStop } from "@/lib/location-history";

const stop = (id: string): VisitedStop => ({
  id, userId: "u1", latitude: -6.2, longitude: 106.81,
  arrivedAt: "2026-11-20T10:00:00Z", departedAt: "2026-11-20T10:30:00Z",
  durationMinutes: 30, pointCount: 3, isCurrent: false,
});

afterEach(() => vi.useRealTimers());

describe("usePlaceNames", () => {
  it("geocodes each stop once, sequentially", async () => {
    vi.useFakeTimers();
    const stops = [stop("s1"), stop("s2")]; // stable identity across renders
    const { reverseGeocodeName } = await import("@/lib/routing");
    vi.mocked(reverseGeocodeName).mockClear();
    const { result } = renderHook(() => usePlaceNames(stops));
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
    expect(reverseGeocodeName).toHaveBeenCalledTimes(2);
    expect(result.current.s1).toBe("Kafe");
    expect(result.current.s2).toBe("Kafe");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/place-names.test.tsx`
Expected: FAIL — `usePlaceNames` not exported.

- [ ] **Step 3: Implement in `hooks/useLocation.ts`**

- Import `fetchRoadRoute`, `reverseGeocodeName`, `type LatLng` from `@/lib/routing`; import `useRef` (already imported) and `type VisitedStop` from `@/lib/location-history` (add to the existing type-only import line — note `lib/location-history` imports `LocationHistoryPoint` from `@/hooks/useLocation`, so keep this a **type-only** import to avoid a runtime cycle).
- `useLocationHistory(range = "24h", options?: { enabled?: boolean })` → add `enabled: options?.enabled ?? true` to the `useQuery` options.
- Add:

```ts
export function useRoadRoute(from: LatLng | null, to: LatLng | null, enabled: boolean) {
  const fromKey = from ? `${from.lat.toFixed(4)},${from.lng.toFixed(4)}` : "";
  const toKey = to ? `${to.lat.toFixed(4)},${to.lng.toFixed(4)}` : "";
  return useQuery({
    queryKey: [...queryKeys.location.all, "route", fromKey, toKey],
    queryFn: ({ signal }) => fetchRoadRoute(from as LatLng, to as LatLng, { signal }),
    enabled: enabled && !!from && !!to,
    staleTime: 60_000,
    retry: false,
    refetchInterval: false,
  });
}

export function usePlaceNames(stops: VisitedStop[]) {
  const [names, setNames] = useState<Record<string, string | null>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pending = stops.filter((s) => !fetchedRef.current.has(s.id));
    if (pending.length === 0) return;
    let cancelled = false;
    const controller = new AbortController();
    void (async () => {
      for (const s of pending) {
        if (cancelled) return;
        fetchedRef.current.add(s.id);
        const name = await reverseGeocodeName(s.latitude, s.longitude, { signal: controller.signal }).catch(() => null);
        if (cancelled) return;
        setNames((prev) => ({ ...prev, [s.id]: name }));
        await new Promise((r) => setTimeout(r, 1100)); // Nominatim: max 1 req/s
      }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [stops]);

  return names;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/place-names.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/useLocation.ts tests/unit/place-names.test.tsx
git commit -m "feat(location): gate history polling, add road-route query and place-name hook"
```

---

### Task 6: PartnerMap — escaping, re-keyed layers, route-snapped distance line

**Files:**
- Modify: `components/location/PartnerMap.tsx`

**Interfaces:**
- Consumes: `RoadRoute` from `@/lib/routing`; `escapeHtml` from `@/lib/escape-html`; `useRoadRoute` is **not** used here (the owner passes the route down).
- Produces: `PartnerMap` props gain `route?: RoadRoute | null` and `stopAddresses?: Record<string, string | null>`; all other props unchanged.

- [ ] **Step 1: Replace direct third-party calls with the lib**

- Delete the local `reverseGeocode` function and `NOMINATIM_CACHE` / `NOMINATIM_CACHE_MAX`.
- Import `reverseGeocodeName` from `@/lib/routing` and `escapeHtml` from `@/lib/escape-html`.
- In the avatar-address effect and the popup factory, call `reverseGeocodeName(p.point.lat, p.point.lng)`; keep the component's `addressCache` state for avatar addresses (the lib has its own cache too — that is fine, the component cache avoids re-renders).

- [ ] **Step 2: Escape every injected string**

- `createStopIcon(index, color, label)` → build `aria-label` with `escapeHtml(label)`.
- `renderUserTrail` point tooltips → `escapeHtml(userLabel)` inside the tooltip string.
- Stop popup HTML → use `escapeHtml` for `displayAddr` and `userLabel` (replace the local `esc`).
- `buildAvatarPopup` → replace its local `esc` with the imported `escapeHtml`.
- `renderUserTrail` is called with `partner?.label ?? "Pasangan"` — the name still flows into HTML, so the escaping above is what makes it safe.

- [ ] **Step 3: Re-key the history effect**

Before the history `useEffect`, compute:

```ts
const selfKey = self ? `${self.point.lat.toFixed(4)},${self.point.lng.toFixed(4)}` : "none";
const partnerKey = partner ? `${partner.point.lat.toFixed(4)},${partner.point.lng.toFixed(4)}` : "none";
```

Change that effect's dependency array from `[history, showHistory, session?.user?.id, self, partner, filterUser, snapToRoads, stops]` to `[history, showHistory, session?.user?.id, selfKey, partnerKey, partner?.label, filterUser, snapToRoads, stops]`.
Inside the effect, read the pins from the existing refs (`selfRef.current`, `partnerRef.current`) instead of the `self`/`partner` props, so no reactive value is referenced outside the dependency array (keeps `react-hooks/exhaustive-deps` clean). The effect body is otherwise unchanged.

- [ ] **Step 4: Draw the distance line along the road route**

In the markers effect (the one that currently builds `lineRef`), when `pins.length === 2`:

```ts
const lineLatLngs: L.LatLngExpression[] =
  route?.geometry && route.geometry.length >= 2
    ? route.geometry
    : latlngs;
lineRef.current = L.polyline(lineLatLngs, {
  color: "#F43F5E",
  weight: route?.geometry ? 4 : 3,
  dashArray: route?.geometry ? undefined : "12 12",
  opacity: 0.75,
  className: route?.geometry ? undefined : "leaflet-connecting-line",
  interactive: false,
}).addTo(markerLayer);
const mid = L.latLngBounds(lineLatLngs).getCenter();
```

The distance label keeps using `haversineMeters` (matches the card) — do not switch it to `route.distanceMeters`.
Add `route` to this effect's dependency array.

- [ ] **Step 5: Stop markers — place names + selected highlight**

- Popup address line: `const displayAddr = stopAddresses?.[stop.id] ?? cachedAddr ?? "Menunggu nama lokasi…";`
- Add a small effect that toggles a CSS class on the selected stop's marker element:

```ts
useEffect(() => {
  stopMarkersRef.current.forEach((marker, id) => {
    marker.getElement()?.classList.toggle("stop-selected", !!selectedStop && selectedStop.id === id);
  });
}, [selectedStop]);
```

- Append to the injected `scaleStyle` CSS: `.stop-selected .visited-stop-marker{transform:scale(1.35);box-shadow:0 0 0 4px rgba(244,63,94,.25);}`

- [ ] **Step 6: Wire the new props into the signature**

Add `route = null` and `stopAddresses` to the props type and destructure. Do not change any other behavior (fitBounds, popups, controls).

- [ ] **Step 7: Verify**

Run: `npm run typecheck` → PASS.
Run: `npx vitest run tests/unit/location-history.test.ts tests/unit/routing.test.ts` → PASS.
Manual: with two seeded users sharing, the partner line bends along roads by default; toggle off → dashed straight line.

- [ ] **Step 8: Commit**

```bash
git add components/location/PartnerMap.tsx
git commit -m "feat(location): route-snapped partner line, stable history layers, escaped map HTML"
```

---

### Task 7: LocationManager — always-visible route toggle + Tempat Singgah UX

**Files:**
- Modify: `components/dashboard/LocationManager.tsx`

**Interfaces:**
- Consumes: `useRoadRoute`, `usePlaceNames` (Task 5), `RoadRoute` type, `PartnerMap` new props (Task 6).

- [ ] **Step 1: Own the road route query**

After `const distance = useDistance(data);` add:

```ts
const routeQuery = useRoadRoute(
  selfPin?.point ?? null,
  partnerPin?.point ?? null,
  snapToRoads && !!selfPin && !!partnerPin,
);
```

Pass to the map: `<PartnerMap ... route={routeQuery.data ?? null} stopAddresses={stopAddresses} />`.

- [ ] **Step 2: Gate history fetching**

`useLocationHistory(historyRange, { enabled: showHistory })`.

- [ ] **Step 3: Load place names**

`const stopAddresses = usePlaceNames([...detectedStops.self, ...detectedStops.partner]);`

- [ ] **Step 4: Always-visible route toggle**

Move the `snapToRoads` button out of the `{showHistory && ...}` block so it renders whenever `(self.isSharing || partner.isSharing)`, next to the history button. Add `aria-pressed={snapToRoads}`. Rename the history button label to `"Tampilkan Riwayat"` / `"Sembunyikan Riwayat"` (the route no longer lives behind it).

- [ ] **Step 5: Stop list rows — names + selected state**

For both partner and self lists, under the existing time line add:

```tsx
{stopAddresses[stop.id] && (
  <p className="text-[10px] text-muted-foreground truncate">{stopAddresses[stop.id]}</p>
)}
```

Add selected styling on the row button: when `selectedStop?.id === stop.id`, use `border-primary bg-primary/5` instead of `border-border/60`, and add `aria-current="true"`.
Render the name line only when a name exists — no permanent "loading" placeholder (a placeholder that never resolves is worse than none).

- [ ] **Step 6: Verify**

Run: `npm run typecheck` → PASS.
Manual checklist:
- Route toggle visible on first load without clicking anything; ON by default.
- Toggle OFF → distance line and history trail are straight; ON → both follow roads.
- History button still shows/hides the trail, duration and filter toolbar.
- Stop list rows show place names after ~1s each; clicking a row flies the map and highlights the marker.
- With history hidden, no `/api/location/history` request is made (DevTools Network).

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/LocationManager.tsx
git commit -m "feat(location): always-on route toggle, place names and selected-stop UX"
```

---

### Task 8: DistanceCard — ETA follows the road route

**Files:**
- Modify: `components/location/DistanceCard.tsx`
- Modify: `components/dashboard/LocationManager.tsx` (pass the prop)

**Interfaces:**
- Consumes: `estimateArrivalFromRoadDistance` (Task 3), `RoadRoute` (Task 2).
- Produces: `DistanceCard` gains optional prop `roadRoute?: { distanceMeters: number; durationSeconds: number | null } | null`.

- [ ] **Step 1: Add the prop and switch the ETA source**

In `DistanceCard.tsx` import `estimateArrivalFromRoadDistance` from `@/lib/geo` and add `roadRoute` to the props. Replace the ETA computation:

```ts
const etaSeconds = roadRoute
  ? estimateArrivalFromRoadDistance(roadRoute.distanceMeters, activeMode)
  : distance !== null && distance > 10
    ? estimateArrivalSeconds(distance, activeMode)
    : 0;
etaStr = formatArrivalTime(etaSeconds);
```

(Keep the existing `distance > 10` guard semantics for the non-route path.)

- [ ] **Step 2: Show which source the ETA uses**

Next to the ETA value, when `roadRoute` is set, render
`<span className="text-[10px] text-muted-foreground">· via rute jalan</span>`.

- [ ] **Step 3: Pass it from the manager**

`<DistanceCard state={data} distance={distance} previousDistance={previousDistance ?? null} roadRoute={snapToRoads ? routeQuery.data ?? null : null} />`

- [ ] **Step 4: Verify**

Run: `npm run typecheck` → PASS.
Manual: with the toggle ON and a route available, switching Jalan kaki / Motor / Mobil changes the ETA using road distance; with the toggle OFF, the ETA reverts to the heuristic.

- [ ] **Step 5: Commit**

```bash
git add components/location/DistanceCard.tsx components/dashboard/LocationManager.tsx
git commit -m "feat(location): ETA follows the road route when snapping is on"
```

---

### Task 9: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Unit + integration**

Run: `npm run test:unit` → PASS.
Run: `npm run test:integration` → PASS.

- [ ] **Step 2: Static gates**

Run: `npm run lint` → PASS.
Run: `npm run typecheck` → PASS.

- [ ] **Step 3: Production build**

Run: `npm run build` → PASS.

- [ ] **Step 4: Manual end-to-end checklist** (seeded data: `npm run seed:location`, two users sharing)

- [ ] Route toggle visible on first load, ON by default, no extra click needed.
- [ ] Distance line bends along roads for both partners; toggle OFF → dashed straight line; ON again → road line.
- [ ] History trail follows roads when ON, straight when OFF, for both users and all four durations.
- [ ] DistanceCard ETA changes with travel mode and uses road distance when ON; "via rute jalan" hint visible.
- [ ] Tempat Singgah: list shows place names; clicking a row flies the map and highlights the marker; current stop shows on the avatar, not as a numbered pin.
- [ ] DevTools Network: no requests to `router.project-osrm.org` or `nominatim.openstreetmap.org`; `/api/route` and `/api/geocode/reverse` called instead; no `/api/location/history` while history is hidden.
- [ ] Offline simulation (DevTools offline): map still renders, straight line, no address names, no uncaught errors in the console.
- [ ] Reduced motion (OS setting): no flying animations, pulse animation calms.
- [ ] Mobile viewport (375px): map, toggle, stop list and card stack without overflow.

- [ ] **Step 5: Commit any stragglers**

```bash
git add -A
git commit -m "chore(location): final verification pass" || true
```
