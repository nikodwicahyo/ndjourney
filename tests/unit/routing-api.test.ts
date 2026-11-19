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
        routes: [
          {
            distance: 1234.5,
            duration: 567.8,
            geometry: { coordinates: [[106.81, -6.2], [106.82, -6.21]] },
          },
        ],
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

  it("does not cache a fallback, so OSRM is retried on the next call", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("down"); });
    vi.stubGlobal("fetch", fetchMock);
    const url = "/api/route?from=-6.4,106.9&to=-6.41,106.91";
    const first = await route.GET(req(url));
    expect(first.headers.get("Cache-Control")).toBe("private, no-store");
    await route.GET(req(url));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid coordinates with 400", async () => {
    const res = await route.GET(req("/api/route?from=999,106.8&to=-6.2,106.8"));
    expect(res.status).toBe(400);
  });

  it("routes through via waypoints in a single OSRM call", async () => {
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      json: async () => ({
        code: "Ok",
        routes: [{
          distance: 2000,
          duration: 300,
          geometry: { coordinates: [[107, -7], [107.01, -7.01], [107.02, -7.02], [107.03, -7.03]] },
        }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await route.GET(req("/api/route?from=-7,107&to=-7.03,107.03&via=-7.01,107.01;-7.02,107.02"));
    expect(res.status).toBe(200);
    expect((await res.json()).data.geometry).toHaveLength(4);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("107.010000,-7.010000");
    expect(url).toContain("107.020000,-7.020000");
  });
});

describe("GET /api/geocode/reverse", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns the best address name", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        address: { road: "Jl. Sudirman", suburb: "Menteng" },
        display_name: "Jl. Sudirman, Menteng, Jakarta",
      }),
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

  it("does not cache an upstream failure as a permanent null name", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("429"); });
    vi.stubGlobal("fetch", fetchMock);
    await geocode.GET(req("/api/geocode/reverse?lat=-7.4&lng=107.4"));
    await geocode.GET(req("/api/geocode/reverse?lat=-7.4&lng=107.4"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("spaces concurrent Nominatim calls at least one second apart", async () => {
    vi.useFakeTimers();
    const callTimes: number[] = [];
    const fetchMock = vi.fn(async () => {
      callTimes.push(Date.now());
      return { ok: true, json: async () => ({ data: { name: "Jalan" } }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = geocode.GET(req("/api/geocode/reverse?lat=-7.5&lng=107.5"));
    const second = geocode.GET(req("/api/geocode/reverse?lat=-7.6&lng=107.6"));
    await vi.advanceTimersByTimeAsync(0); // let the handlers reach the pace queue
    await vi.advanceTimersByTimeAsync(1200);
    await vi.advanceTimersByTimeAsync(1200);
    await Promise.all([first, second]);
    expect(callTimes).toHaveLength(2);
    expect(callTimes[1] - callTimes[0]).toBeGreaterThanOrEqual(1000);
    vi.useRealTimers();
  });
});
