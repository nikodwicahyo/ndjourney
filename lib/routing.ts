import { haversineMeters } from "./geo";

export type LatLng = { lat: number; lng: number };

export type RoadRoute = {
  distanceMeters: number;
  durationSeconds: number | null;
  geometry: Array<[number, number]> | null;
  source: "osrm" | "fallback";
};

const ROUTE_CACHE = new Map<string, RoadRoute>();
const MAX_ROUTE_CACHE = 100;
const GEOCODE_CACHE = new Map<string, string | null>();
const MAX_GEOCODE_CACHE = 300;

function remember<T>(cache: Map<string, T>, max: number, key: string, value: T): void {
  if (cache.size >= max) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, value);
}

function routeKey(from: LatLng, to: LatLng): string {
  return `${from.lat.toFixed(4)},${from.lng.toFixed(4)}|${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
}

function straightFallback(from: LatLng, to: LatLng): RoadRoute {
  return {
    distanceMeters: haversineMeters(
      { latitude: from.lat, longitude: from.lng },
      { latitude: to.lat, longitude: to.lng },
    ),
    durationSeconds: null,
    geometry: null,
    source: "fallback",
  };
}

/** Fetch a road-snapped route for two points via our own API. Never throws. */
export async function fetchRoadRoute(
  from: LatLng,
  to: LatLng,
  opts: { signal?: AbortSignal } = {},
): Promise<RoadRoute> {
  if (
    haversineMeters(
      { latitude: from.lat, longitude: from.lng },
      { latitude: to.lat, longitude: to.lng },
    ) < 1
  ) {
    return { distanceMeters: 0, durationSeconds: 0, geometry: [[from.lat, from.lng]], source: "fallback" };
  }

  const key = routeKey(from, to);
  const cached = ROUTE_CACHE.get(key);
  if (cached) return cached;

  try {
    const res = await fetch(
      `/api/route?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}`,
      { signal: opts.signal },
    );
    if (!res.ok) throw new Error(`route API ${res.status}`);
    const json = (await res.json()) as { data?: RoadRoute };
    if (!json?.data) throw new Error("route API returned no data");
    const result: RoadRoute = {
      distanceMeters: json.data.distanceMeters,
      durationSeconds: json.data.durationSeconds ?? null,
      geometry: Array.isArray(json.data.geometry) && json.data.geometry.length >= 2
        ? json.data.geometry
        : null,
      source: json.data.source === "osrm" ? "osrm" : "fallback",
    };
    remember(ROUTE_CACHE, MAX_ROUTE_CACHE, key, result);
    return result;
  } catch {
    return straightFallback(from, to);
  }
}

/** Reverse-geocode a point via our own API. Never throws; caches null too. */
export async function reverseGeocodeName(
  lat: number,
  lng: number,
  opts: { signal?: AbortSignal } = {},
): Promise<string | null> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (GEOCODE_CACHE.has(key)) return GEOCODE_CACHE.get(key) ?? null;

  try {
    const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`, {
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(`geocode API ${res.status}`);
    const json = (await res.json()) as { data?: { name?: string | null } };
    const name = json?.data?.name ?? null;
    remember(GEOCODE_CACHE, MAX_GEOCODE_CACHE, key, name);
    return name;
  } catch {
    return null;
  }
}
