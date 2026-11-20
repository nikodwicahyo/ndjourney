import { describe, it, expect, vi, afterEach } from "vitest";
import { reverseGeocodeName } from "@/lib/routing";

afterEach(() => vi.unstubAllGlobals());

describe("reverseGeocodeName", () => {
  it("retries a transient unnamed result instead of caching null forever", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { name: null } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await reverseGeocodeName(-8.11, 112.11)).toBeNull();
    expect(await reverseGeocodeName(-8.11, 112.11)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("caches a real name so repeated stops do not refetch", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { name: "Jl. Sudirman" } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await reverseGeocodeName(-8.22, 112.22)).toBe("Jl. Sudirman");
    expect(await reverseGeocodeName(-8.22, 112.22)).toBe("Jl. Sudirman");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
