import { describe, it, expect, vi, beforeEach } from "vitest";

// P1 auth brute-force plan: per-account backoff + XFF last-entry.
const prismaUserMock = vi.hoisted(() => ({ findUnique: vi.fn() }));
const redisMock = vi.hoisted(() => ({
  incr: vi.fn(async () => 1),
  expire: vi.fn(async () => 1),
  del: vi.fn(async () => 1),
}));
const bcryptCompareMock = vi.hoisted(() => vi.fn(async (pw: string) => pw === "correct-pw"));
const cookieSetMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: { user: prismaUserMock } }));
vi.mock("@/lib/redis", () => ({
  getCached: vi.fn(async () => null),
  setCached: vi.fn(async () => {}),
  redis: redisMock,
  // pass-through: exercise the real counter logic against redisMock.
  withRedisTimeout: (p: Promise<unknown>) => p,
}));
vi.mock("bcryptjs", () => ({ default: { compare: bcryptCompareMock } }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: vi.fn(), set: cookieSetMock, delete: vi.fn() })),
}));
vi.mock("next-auth", () => ({
  default: vi.fn(() => ({ handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() })),
}));
vi.mock("next-auth/providers/google", () => ({ default: vi.fn(() => ({})) }));
vi.mock("next-auth/providers/credentials", () => ({ default: vi.fn(() => ({})) }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: vi.fn(() => ({})) }));

async function loadAuth() {
  vi.resetModules();
  return await import("@/lib/auth");
}

const USER = {
  id: "u1",
  email: "a@x.com",
  name: "A",
  image: null,
  role: "PARTNER",
  password: "hashed-cost-12",
};

describe("authFailDelayMs (pure backoff math)", () => {
  it("0 below threshold, +500ms per failure after, capped at 2000ms", async () => {
    const { authFailDelayMs } = await loadAuth();
    expect(authFailDelayMs(0)).toBe(0);
    expect(authFailDelayMs(4)).toBe(0);
    expect(authFailDelayMs(5)).toBe(500);
    expect(authFailDelayMs(6)).toBe(1000);
    expect(authFailDelayMs(8)).toBe(2000);
    expect(authFailDelayMs(100)).toBe(2000);
  });
});

describe("recordAuthFailure / clearAuthFailures", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts per normalized account key with 15-minute window", async () => {
    const { recordAuthFailure } = await loadAuth();
    await recordAuthFailure("A@X.com");
    expect(redisMock.incr).toHaveBeenCalledWith("auth:fail:A@X.com");
    expect(redisMock.expire).toHaveBeenCalledWith("auth:fail:A@X.com", 900);
  });

  it("sleeps progressively past the threshold", async () => {
    vi.useFakeTimers();
    try {
      redisMock.incr.mockResolvedValue(6); // 1000ms bucket
      const { recordAuthFailure } = await loadAuth();
      const pending = recordAuthFailure("a@x.com");
      await vi.advanceTimersByTimeAsync(1000);
      await pending;
    } finally {
      vi.useRealTimers();
    }
  });

  it("no sleep below threshold", async () => {
    vi.useFakeTimers();
    try {
      redisMock.incr.mockResolvedValue(3);
      const { recordAuthFailure } = await loadAuth();
      await recordAuthFailure("a@x.com");
    } finally {
      vi.useRealTimers();
    }
  });

  it("fail-open: Redis error never rejects", async () => {
    redisMock.incr.mockRejectedValueOnce(new Error("redis down"));
    const { recordAuthFailure, clearAuthFailures } = await loadAuth();
    await expect(recordAuthFailure("a@x.com")).resolves.toBeUndefined();
    redisMock.del.mockRejectedValueOnce(new Error("redis down"));
    await expect(clearAuthFailures("a@x.com")).resolves.toBeUndefined();
  });

  it("clearAuthFailures deletes the account key", async () => {
    const { clearAuthFailures } = await loadAuth();
    await clearAuthFailures("a@x.com");
    expect(redisMock.del).toHaveBeenCalledWith("auth:fail:a@x.com");
  });
});

describe("authorizeCredentials wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.incr.mockResolvedValue(1);
  });

  it("success returns the user shape and clears the counter", async () => {
    prismaUserMock.findUnique.mockResolvedValue(USER);
    const { authorizeCredentials } = await loadAuth();
    const r = await authorizeCredentials({ email: "A@x.com", password: "correct-pw" });
    expect(r).toMatchObject({ id: "u1", email: "a@x.com" });
    expect(redisMock.del).toHaveBeenCalledWith("auth:fail:a@x.com");
    expect(redisMock.incr).not.toHaveBeenCalled();
  });

  it("wrong password records a failure (uniform key)", async () => {
    prismaUserMock.findUnique.mockResolvedValue(USER);
    const { authorizeCredentials } = await loadAuth();
    const r = await authorizeCredentials({ email: "a@x.com", password: "nope" });
    expect(r).toBeNull();
    expect(redisMock.incr).toHaveBeenCalledWith("auth:fail:a@x.com");
    expect(redisMock.del).not.toHaveBeenCalled();
  });

  it("unknown email records a failure identically (no throttle oracle)", async () => {
    prismaUserMock.findUnique.mockResolvedValue(null);
    const { authorizeCredentials } = await loadAuth();
    const r = await authorizeCredentials({ email: "ghost@x.com", password: "nope" });
    expect(r).toBeNull();
    expect(bcryptCompareMock).toHaveBeenCalled(); // dummy compare still runs
    expect(redisMock.incr).toHaveBeenCalledWith("auth:fail:ghost@x.com");
  });

  it("google-only account records a failure and sets the cookie", async () => {
    prismaUserMock.findUnique.mockResolvedValue({ ...USER, password: null });
    const { authorizeCredentials } = await loadAuth();
    const r = await authorizeCredentials({ email: "a@x.com", password: "correct-pw" });
    expect(r).toBeNull();
    expect(cookieSetMock).toHaveBeenCalledWith(
      "auth_error_reason",
      "google_only",
      expect.anything(),
    );
    expect(redisMock.incr).toHaveBeenCalledWith("auth:fail:a@x.com");
  });

  it("missing credentials short-circuit without touching Redis", async () => {
    const { authorizeCredentials } = await loadAuth();
    expect(await authorizeCredentials({ email: "", password: "x" })).toBeNull();
    expect(await authorizeCredentials(undefined)).toBeNull();
    expect(redisMock.incr).not.toHaveBeenCalled();
  });
});

describe("getClientIp (XFF last-entry)", () => {
  it("takes the closest proxy entry, not the forged first one", async () => {
    vi.resetModules();
    const { getClientIp } = await import("@/lib/rate-limit");
    const req = (headers: Record<string, string>) =>
      new Request("http://localhost/api/auth/session", { headers });
    expect(getClientIp(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("5.6.7.8");
    expect(getClientIp(req({ "x-forwarded-for": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(getClientIp(req({ "x-real-ip": "7.7.7.7" }))).toBe("7.7.7.7");
    expect(getClientIp(req({}))).toBe("unknown");
  });
});
