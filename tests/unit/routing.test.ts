import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchRoadRoute, reverseGeocodeName, shouldUseRoadRoute, effectiveDistance } from "@/lib/routing";
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

  it("does not cache a fallback, so a recovered upstream is retried", async () => {
    const mock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { distanceMeters: 500, durationSeconds: null, geometry: null, source: "fallback" } }),
    }));
    vi.stubGlobal("fetch", mock);
    const p = { lat: -6.7, lng: 106.7 };
    const q = { lat: -6.71, lng: 106.71 };
    await fetchRoadRoute(p, q);
    await fetchRoadRoute(p, q);
    expect(mock).toHaveBeenCalledTimes(2);
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

describe("shouldUseRoadRoute", () => {
  it("rejects fallback routes so the ETA is not labelled as road-based", () => {
    expect(shouldUseRoadRoute({ distanceMeters: 100, durationSeconds: null, geometry: null, source: "fallback" })).toBeNull();
  });

  it("accepts a real OSRM route", () => {
    const route = { distanceMeters: 100, durationSeconds: 30, geometry: [[-6.2, 106.8], [-6.21, 106.81]] as Array<[number, number]>, source: "osrm" as const };
    expect(shouldUseRoadRoute(route)).toBe(route);
  });
});

describe("effectiveDistance", () => {
  const road = { distanceMeters: 14088, durationSeconds: 900, geometry: [[-6.2, 106.8], [-6.21, 106.81]] as Array<[number, number]>, source: "osrm" as const };

  it("shows road distance when a real route is active", () => {
    expect(effectiveDistance(road, 8200)).toBe(14088);
  });

  it("keeps straight-line distance when there is no route", () => {
    expect(effectiveDistance(null, 8200)).toBe(8200);
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
