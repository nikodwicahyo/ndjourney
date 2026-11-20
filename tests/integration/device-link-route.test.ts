import { beforeEach, describe, expect, it, vi } from "vitest";

// Route wiring only. The code primitives (brute-force, single-use, expiry)
// are covered in tests/unit/device-link.test.ts — don't duplicate them here.
const mocks = vi.hoisted(() => ({
  createDeviceLink: vi.fn(async (_userId: string) => ({
    code: "123456",
    expiresAt: "2026-11-20T01:00:00.000Z",
  })),
  revokeDeviceLinks: vi.fn(async (_userId: string) => {}),
  withRateLimit: vi.fn(),
}));

vi.mock("@/lib/device-link", () => ({
  createDeviceLink: mocks.createDeviceLink,
  revokeDeviceLinks: mocks.revokeDeviceLinks,
}));
vi.mock("@/lib/rate-limit", () => ({
  withRateLimit: mocks.withRateLimit,
  rateLimitConfigs: { auth: { maxRequests: 10, windowSeconds: 900, keyPrefix: "auth" } },
}));

const route = await import("@/app/api/auth/device-link/route");

const USER_ID = "user-1";

function allow() {
  mocks.withRateLimit.mockResolvedValue({
    allowed: true,
    remaining: 9,
    session: { user: { id: USER_ID } },
  });
}

function deny(status: number) {
  mocks.withRateLimit.mockResolvedValue({
    allowed: false,
    remaining: 0,
    response: new Response(JSON.stringify({ error: "blocked" }), { status }),
  });
}

const req = (method: "POST" | "DELETE") =>
  new Request(`http://localhost/api/auth/device-link`, { method });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  allow();
});

describe("POST /api/auth/device-link", () => {
  it("mints a code for the session user and never caches it", async () => {
    const res = await route.POST(req("POST"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.json()).toEqual({
      data: { code: "123456", expiresAt: "2026-11-20T01:00:00.000Z" },
    });
    expect(mocks.createDeviceLink).toHaveBeenCalledWith(USER_ID);
  });

  it("propagates the rate limiter's response untouched", async () => {
    deny(401);
    const res = await route.POST(req("POST"));
    expect(res.status).toBe(401);
    expect(mocks.createDeviceLink).not.toHaveBeenCalled();
  });

  it("maps a DB failure to a 500 without leaking the error", async () => {
    mocks.createDeviceLink.mockRejectedValueOnce(new Error("db down"));
    const res = await route.POST(req("POST"));
    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await res.json()).error).not.toContain("db down");
  });
});

describe("DELETE /api/auth/device-link", () => {
  it("revokes every outstanding code for the session user", async () => {
    const res = await route.DELETE(req("DELETE"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { revoked: true } });
    expect(mocks.revokeDeviceLinks).toHaveBeenCalledWith(USER_ID);
  });

  it("propagates the rate limiter's response untouched", async () => {
    deny(429);
    const res = await route.DELETE(req("DELETE"));
    expect(res.status).toBe(429);
    expect(mocks.revokeDeviceLinks).not.toHaveBeenCalled();
  });

  it("maps a DB failure to a 500", async () => {
    mocks.revokeDeviceLinks.mockRejectedValueOnce(new Error("db down"));
    const res = await route.DELETE(req("DELETE"));
    expect(res.status).toBe(500);
  });
});
