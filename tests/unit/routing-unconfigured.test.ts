import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

delete process.env.OSRM_BASE_URL;
delete process.env.NOMINATIM_URL;
delete process.env.NOMINATIM_USER_AGENT;

vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "u1" } })) }));

const route = await import("@/app/api/route/route");
const geocode = await import("@/app/api/geocode/reverse/route");

describe("public upstream defaults (no env config, no key)", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("uses the official OSRM demo endpoint by default", async () => {
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      json: async () => ({
        code: "Ok",
        routes: [{
          distance: 100,
          duration: 10,
          geometry: { coordinates: [[106.8, -6.2], [106.81, -6.21]] },
        }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await route.GET(new Request("http://localhost/api/route?from=-6.2,106.8&to=-6.21,106.81"));
    expect(res.status).toBe(200);
    expect((await res.json()).data.source).toBe("osrm");
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "https://router.project-osrm.org/route/v1/driving/",
    );
  });

  it("uses the official Nominatim endpoint and identifies the app", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      json: async () => ({ address: { road: "Jl. Sudirman" } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await geocode.GET(new Request("http://localhost/api/geocode/reverse?lat=-6.9&lng=106.9"));
    expect(res.status).toBe(200);
    expect((await res.json()).data.name).toBe("Jl. Sudirman");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("https://nominatim.openstreetmap.org/reverse?");
    expect((init.headers as Record<string, string>)["User-Agent"]).toContain("NdJourney/1.0");
  });
});
