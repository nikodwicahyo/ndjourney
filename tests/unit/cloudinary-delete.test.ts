import { describe, it, expect, vi, beforeEach } from "vitest";

const destroyMock = vi.hoisted(() => vi.fn());

vi.mock("cloudinary", () => ({
  v2: {
    config: vi.fn(),
    uploader: { destroy: destroyMock },
    url: vi.fn(() => "https://x"),
    utils: { api_sign_request: vi.fn(() => "sig") },
  },
}));

async function load() {
  vi.resetModules();
  return (await import("@/lib/cloudinary")).deleteFromCloudinary;
}

// Delete must be idempotent: Cloudinary reports "not found" for already-gone
// assets, and failing hard on that orphans the DB row forever (no API path
// could delete it again — seen live with E2E cleanup rows).
describe("deleteFromCloudinary idempotency", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves on ok", async () => {
    destroyMock.mockResolvedValue({ result: "ok" });
    const fn = await load();
    await expect(fn("a/b", "image")).resolves.toBeUndefined();
    expect(destroyMock).toHaveBeenCalledWith("a/b", expect.objectContaining({ resource_type: "image" }));
  });

  it("resolves on not found (already gone)", async () => {
    destroyMock.mockResolvedValue({ result: "not found" });
    const fn = await load();
    await expect(fn("a/gone", "image")).resolves.toBeUndefined();
  });

  it("still throws on real failures", async () => {
    destroyMock.mockResolvedValue({ result: "error" });
    const fn = await load();
    await expect(fn("a/b", "image")).rejects.toThrow("did not delete media");
    destroyMock.mockRejectedValueOnce(new Error("network down"));
    await expect(fn("a/b", "image")).rejects.toThrow("network down");
  });
});
