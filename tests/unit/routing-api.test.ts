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
});
