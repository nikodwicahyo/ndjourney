import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APK_URL, MANIFEST_URL } from "@/lib/native/version";

const fetchMock = vi.fn();

const route = await import("@/app/api/native/version/route");

const manifest = {
  build: 12,
  version: "1.0.12",
  apkUrl: APK_URL,
  releasedAt: "2026-11-20T12:00:00Z",
  notes: "perbaikan lokasi",
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/native/version", () => {
  it("proxies the release manifest without caching it", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => manifest,
    });

    const res = await route.GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ data: manifest });
    expect(fetchMock).toHaveBeenCalledWith(
      MANIFEST_URL,
      expect.objectContaining({ next: { revalidate: 300 } }),
    );
  });

  it("fails soft when GitHub has no release yet", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });

    const res = await route.GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: null });
  });

  it("drops a tampered manifest instead of returning an unsafe APK URL", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ...manifest, apkUrl: "https://evil.example/malware.apk" }),
    });

    const res = await route.GET();

    expect(await res.json()).toEqual({ data: null });
  });

  it("fails soft on network errors", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    const res = await route.GET();

    expect(await res.json()).toEqual({ data: null });
  });
});
