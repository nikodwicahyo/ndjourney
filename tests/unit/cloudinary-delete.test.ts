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

async function loadUrlDelete() {
  vi.resetModules();
  return (await import("@/lib/cloudinary")).deleteFromCloudinaryUrl;
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

describe("deleteFromCloudinaryUrl ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    destroyMock.mockResolvedValue({ result: "ok" });
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  });

  it("refuses a foreign cloud name", async () => {
    const fn = await loadUrlDelete();
    await fn("https://res.cloudinary.com/other-cloud/image/upload/v1/ndjourney-web/u1/a.jpg", ["u1"]);
    expect(destroyMock).not.toHaveBeenCalled();
  });

  it("refuses a publicId outside the caller's namespace", async () => {
    const fn = await loadUrlDelete();
    await fn("https://res.cloudinary.com/test-cloud/image/upload/v1/ndjourney-web/u2/a.jpg", ["u1"]);
    expect(destroyMock).not.toHaveBeenCalled();
  });

  it("deletes an owned asset and normalizes the version segment", async () => {
    const fn = await loadUrlDelete();
    await fn("https://res.cloudinary.com/test-cloud/image/upload/v999/ndjourney-web/u1/a.jpg", ["u1"]);
    expect(destroyMock).toHaveBeenCalledWith(
      "ndjourney-web/u1/a",
      expect.objectContaining({ resource_type: "image" }),
    );
  });
});
