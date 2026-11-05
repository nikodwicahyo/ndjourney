import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const me = "user-me";
const coupleId = "couple-1";

const endpoint = "https://fcm.googleapis.com/fcm/send/abc-123";
const badEndpoint = "http://example.com/push/abc-123";
const keys = { p256dh: "p256dh-value", auth: "auth-value" };

const pushSubscriptionMock = vi.hoisted(() => ({
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  findUnique: vi.fn(),
}));

const coupleMemberMock = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pushSubscription: pushSubscriptionMock,
    coupleMember: coupleMemberMock,
  },
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/redis", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 59, reset: 0 })),
  getCached: vi.fn(async () => null),
  setCached: vi.fn(async () => {}),
  cacheKey: (...p: string[]) => p.join(":"),
}));

const { auth } = await import("@/lib/auth");
const { POST: subscribe } = await import("@/app/api/push/subscribe/route");
const { POST: unsubscribe } = await import("@/app/api/push/unsubscribe/route");

const rateLimit = await import("@/lib/redis");

describe("push API (POST /api/push/subscribe, POST /api/push/unsubscribe)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: me } } as never);
    vi.mocked(coupleMemberMock.findUnique).mockResolvedValue({ coupleId } as never);
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 59,
      reset: 0,
    });
  });

  it("P-01: unauthenticated subscribe → 401", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await subscribe(
      new Request("http://localhost/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({ endpoint, keys }),
      }),
    );
    expect(res.status).toBe(401);
    expect(pushSubscriptionMock.upsert).not.toHaveBeenCalled();
  });

  it("P-02: unauthenticated unsubscribe → 401", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await unsubscribe(
      new Request("http://localhost/api/push/unsubscribe", {
        method: "POST",
        body: JSON.stringify({ endpoint }),
      }),
    );
    expect(res.status).toBe(401);
    expect(pushSubscriptionMock.deleteMany).not.toHaveBeenCalled();
  });

  it("P-03: non-https endpoint → 400", async () => {
    const res = await subscribe(
      new Request("http://localhost/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({ endpoint: badEndpoint, keys }),
      }),
    );
    expect(res.status).toBe(400);
    expect(pushSubscriptionMock.upsert).not.toHaveBeenCalled();
  });

  it("P-04: malformed endpoint → 400", async () => {
    const res = await subscribe(
      new Request("http://localhost/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({ endpoint: "not-a-url", keys }),
      }),
    );
    expect(res.status).toBe(400);
    expect(pushSubscriptionMock.upsert).not.toHaveBeenCalled();
  });

  it("P-05: happy upsert stores keys keyed by endpoint for the session user", async () => {
    vi.mocked(pushSubscriptionMock.upsert).mockResolvedValue({} as never);

    const res = await subscribe(
      new Request("http://localhost/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({ endpoint, keys }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(pushSubscriptionMock.upsert).toHaveBeenCalledWith({
      where: { endpoint },
      update: expect.objectContaining({ p256dh: keys.p256dh, auth: keys.auth }),
      create: expect.objectContaining({
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userId: me,
        coupleId,
      }),
    });
  });

  it("P-06: re-subscribing the same endpoint upserts (replaces keys)", async () => {
    vi.mocked(pushSubscriptionMock.upsert).mockResolvedValue({} as never);

    await subscribe(
      new Request("http://localhost/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({ endpoint, keys }),
      }),
    );
    await subscribe(
      new Request("http://localhost/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({ endpoint, keys: { p256dh: "new-p256dh", auth: "new-auth" } }),
      }),
    );

    const calls = (pushSubscriptionMock.upsert as any).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1][0].update.p256dh).toBe("new-p256dh");
    expect(calls[1][0].create.userId).toBe(me);
  });

  it("P-07: unsubscribe deletes only the session user's row", async () => {
    vi.mocked(pushSubscriptionMock.deleteMany).mockResolvedValue({ count: 1 } as never);

    const res = await unsubscribe(
      new Request("http://localhost/api/push/unsubscribe", {
        method: "POST",
        body: JSON.stringify({ endpoint }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(pushSubscriptionMock.deleteMany).toHaveBeenCalledWith({
      where: { userId: me, endpoint },
    });
  });

  it("P-08: rate limit trips on call 61 within the window → 429", async () => {
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      reset: 0,
    });

    const res = await subscribe(
      new Request("http://localhost/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({ endpoint, keys }),
      }),
    );
    expect(res.status).toBe(429);
    expect(pushSubscriptionMock.upsert).not.toHaveBeenCalled();
  });
});
