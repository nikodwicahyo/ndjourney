import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { haversineMeters } from "@/lib/geo";
import { pacedFetch } from "@/lib/paced-fetch";

export const dynamic = "force-dynamic";

// The official demo needs no key/signup and works with zero config. The env
// override exists so ops can switch instances without a software update.
// Demo policy: reasonable non-commercial use, <=1 req/s, no uptime guarantee.
// Source: https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server
const OSRM_BASE_URL =
  process.env.OSRM_BASE_URL?.replace(/\/+$/, "") || "https://router.project-osrm.org";

type RoutePayload = {
  distanceMeters: number;
  durationSeconds: number | null;
  geometry: Array<[number, number]> | null;
  source: "osrm" | "fallback";
};

const ROUTE_CACHE = new Map<string, RoutePayload>();
const MAX_ROUTE_CACHE = 200;

function parsePair(raw: string | null): { lat: number; lng: number } | null {
  if (!raw) return null;
  const parts = raw.split(",");
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function parseVia(raw: string | null | undefined): Array<{ lat: number; lng: number }> {
  if (!raw) return [];
  const pairs = raw.split(";").filter(Boolean);
  if (pairs.length > 38) throw new Error("Too many via points");
  const points = pairs.map((pair) => {
    const parts = pair.split(",");
    if (parts.length !== 2) throw new Error("Bad via point");
    return parsePair(pair);
  });
  if (points.some((p) => p === null)) throw new Error("Bad via point");
  return points as Array<{ lat: number; lng: number }>;
}

function cacheKey(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  via: Array<{ lat: number; lng: number }>,
): string {
  const base = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}|${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  return via.length
    ? `${base}|${via.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(";")}`
    : base;
}

function remember(key: string, payload: RoutePayload): void {
  if (ROUTE_CACHE.size >= MAX_ROUTE_CACHE) {
    const oldest = ROUTE_CACHE.keys().next().value;
    if (oldest) ROUTE_CACHE.delete(oldest);
  }
  ROUTE_CACHE.set(key, payload);
}

function straightFallback(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): RoutePayload {
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

export async function GET(request?: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let from: { lat: number; lng: number } | null = null;
    let to: { lat: number; lng: number } | null = null;
    let via: Array<{ lat: number; lng: number }> = [];
    try {
      const params = new URL(request?.url ?? "http://localhost").searchParams;
      from = parsePair(params.get("from"));
      to = parsePair(params.get("to"));
      via = parseVia(params.get("via"));
    } catch {
      return NextResponse.json({ error: "Parameter tidak valid" }, { status: 400 });
    }
    if (!from || !to) {
      return NextResponse.json({ error: "Parameter tidak valid" }, { status: 400 });
    }

    const key = cacheKey(from, to, via);
    const cached = ROUTE_CACHE.get(key);
    if (cached) {
      return NextResponse.json(
        { data: cached },
        { headers: { "Cache-Control": "private, max-age=60" } },
      );
    }

    let payload: RoutePayload;
    try {
      const coordinates = [
        `${from.lng.toFixed(6)},${from.lat.toFixed(6)}`,
        ...via.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`),
        `${to.lng.toFixed(6)},${to.lat.toFixed(6)}`,
      ];
      const url =
        `${OSRM_BASE_URL}/route/v1/driving/` +
        coordinates.join(";") +
        `?overview=full&geometries=geojson`;
      const res = await pacedFetch(url, {
        signal: AbortSignal.timeout(4000),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`OSRM ${res.status}`);

      const data = (await res.json()) as {
        code?: string;
        routes?: Array<{
          distance?: number;
          duration?: number;
          geometry?: { coordinates?: [number, number][] };
        }>;
      };
      const route = data?.code === "Ok" ? data.routes?.[0] : undefined;
      const coords = route?.geometry?.coordinates;
      if (!coords || !Array.isArray(coords) || coords.length < 2) {
        throw new Error("OSRM returned no geometry");
      }

      const geometry = coords.map((c) => [c[1], c[0]] as [number, number]);
      payload = {
        distanceMeters: route.distance ?? 0,
        durationSeconds: route.duration ?? null,
        geometry,
        source: "osrm",
      };
    } catch (error) {
      console.warn("[api/route] OSRM unavailable, using straight line:", error);
      payload = straightFallback(from, to);
    }

    // Only cache successful road routes. A fallback must be retried on the
    // next request so the app recovers as soon as OSRM comes back.
    if (payload.source === "osrm") remember(key, payload);
    return NextResponse.json(
      { data: payload },
      {
        headers: {
          "Cache-Control": payload.source === "osrm" ? "private, max-age=60" : "private, no-store",
        },
      },
    );
  } catch (error) {
    console.error("[api/route] unexpected error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server." },
      { status: 500 },
    );
  }
}
