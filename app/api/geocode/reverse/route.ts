import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const GEOCODE_CACHE = new Map<string, string | null>();
const MAX_GEOCODE_CACHE = 500;
const NOMINATIM_MIN_INTERVAL_MS = 1100;

// Nominatim's policy allows ~1 request/second. Serialize every upstream call
// through this chain so concurrent stops/avatars cannot trigger 429s.
let geocodeChain: Promise<void> = Promise.resolve();
let lastGeocodeAt = 0;

function pacedFetch(url: string, init: RequestInit): Promise<Response> {
  const run = geocodeChain.then(async () => {
    // Clamp: a clock jump (or fake timers in tests) must never produce a
    // multi-year wait.
    const wait = Math.max(
      0,
      Math.min(NOMINATIM_MIN_INTERVAL_MS, NOMINATIM_MIN_INTERVAL_MS - (Date.now() - lastGeocodeAt)),
    );
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastGeocodeAt = Date.now();
    return fetch(url, init);
  });
  geocodeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function parseCoord(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function remember(key: string, name: string | null): void {
  if (GEOCODE_CACHE.size >= MAX_GEOCODE_CACHE) {
    const oldest = GEOCODE_CACHE.keys().next().value;
    if (oldest) GEOCODE_CACHE.delete(oldest);
  }
  GEOCODE_CACHE.set(key, name);
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const params = new URL(request.url).searchParams;
      lat = parseCoord(params.get("lat"));
      lng = parseCoord(params.get("lng"));
    } catch {
      return NextResponse.json({ error: "Parameter tidak valid" }, { status: 400 });
    }
    if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: "Parameter tidak valid" }, { status: 400 });
    }

    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (GEOCODE_CACHE.has(key)) {
      return NextResponse.json(
        { data: { name: GEOCODE_CACHE.get(key) ?? null } },
        { headers: { "Cache-Control": "private, max-age=3600" } },
      );
    }

    let name: string | null = null;
    let upstreamSucceeded = false;
    try {
      const url =
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}` +
        `&format=json&zoom=16&accept-language=id`;
      const res = await pacedFetch(url, {
        signal: AbortSignal.timeout(3000),
        headers: {
          "User-Agent": "NdJourney/1.0 (https://ndjourney.vercel.app)",
          "Accept-Language": "id",
          Accept: "application/json",
        },
      });
      if (!res.ok) throw new Error(`Nominatim ${res.status}`);

      const data = (await res.json()) as {
        address?: {
          road?: string;
          suburb?: string;
          quarter?: string;
          city_district?: string;
        };
        display_name?: string;
      };
      name =
        data?.address?.road ||
        data?.address?.suburb ||
        data?.address?.quarter ||
        data?.address?.city_district ||
        data?.display_name?.split(",")?.[0]?.trim() ||
        null;
      upstreamSucceeded = true;
    } catch (error) {
      console.warn("[api/geocode/reverse] Nominatim unavailable:", error);
    }

    // A 429/network failure is not an answer — retry later instead of caching
    // a permanent null that would leave the stop unnamed forever.
    if (upstreamSucceeded) remember(key, name);
    return NextResponse.json(
      { data: { name } },
      {
        headers: {
          "Cache-Control": upstreamSucceeded ? "private, max-age=3600" : "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[api/geocode/reverse] unexpected error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server." },
      { status: 500 },
    );
  }
}
