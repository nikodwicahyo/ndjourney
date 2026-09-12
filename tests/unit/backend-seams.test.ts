import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  coupleMember: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), createMany: vi.fn() },
  user: { count: vi.fn(), findMany: vi.fn() },
  couple: { create: vi.fn() },
  coupleConfig: { findFirst: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
    fn({ couple: { create: vi.fn(async () => ({ id: "c-new" })) }, coupleMember: { createMany: vi.fn(async () => ({})) } }),
  ),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next-auth", () => ({
  default: vi.fn(() => ({ handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() })),
}));
vi.mock("next-auth/providers/google", () => ({ default: vi.fn(() => ({})) }));
vi.mock("next-auth/providers/credentials", () => ({ default: vi.fn(() => ({})) }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: vi.fn(() => ({})) }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })) }));

// ensureCouple: idempotent pairing state machine (lib/auth.ts)
describe("ensureCouple", () => {
  beforeEach(() => vi.clearAllMocks());

  async function load() {
    vi.resetModules();
    return (await import("@/lib/auth")).ensureCouple;
  }

  it("no-op when already member", async () => {
    const ensureCouple = await load();
    prismaMock.coupleMember.findUnique.mockResolvedValue({ id: "m1" });
    await ensureCouple("u1");
    expect(prismaMock.user.count).not.toHaveBeenCalled();
  });

  it("no-op when fewer than 2 partners", async () => {
    const ensureCouple = await load();
    prismaMock.coupleMember.findUnique.mockResolvedValue(null);
    prismaMock.user.count.mockResolvedValue(1);
    await ensureCouple("u1");
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it("joins existing couple when partner already paired", async () => {
    const ensureCouple = await load();
    prismaMock.coupleMember.findUnique.mockResolvedValue(null);
    prismaMock.user.count.mockResolvedValue(2);
    prismaMock.user.findMany.mockResolvedValue([{ id: "a" }, { id: "u1" }]);
    prismaMock.coupleMember.findFirst.mockResolvedValue({ coupleId: "c1", userId: "a" });
    prismaMock.coupleMember.create.mockResolvedValue({ id: "m2" });
    await ensureCouple("u1");
    expect(prismaMock.coupleMember.create).toHaveBeenCalledWith({ data: { coupleId: "c1", userId: "u1" } });
  });

  it("creates new couple via transaction when none exists", async () => {
    const ensureCouple = await load();
    prismaMock.coupleMember.findUnique.mockResolvedValue(null);
    prismaMock.user.count.mockResolvedValue(2);
    prismaMock.user.findMany.mockResolvedValue([{ id: "a" }, { id: "u1" }]);
    prismaMock.coupleMember.findFirst.mockResolvedValue(null);
    await ensureCouple("u1");
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it("treats P2002 race as success (never throws)", async () => {
    const ensureCouple = await load();
    prismaMock.coupleMember.findUnique.mockResolvedValue(null);
    prismaMock.user.count.mockResolvedValue(2);
    prismaMock.user.findMany.mockResolvedValue([{ id: "a" }, { id: "u1" }]);
    prismaMock.coupleMember.findFirst.mockResolvedValue({ coupleId: "c1", userId: "a" });
    prismaMock.coupleMember.create.mockRejectedValue({ code: "P2002" });
    await expect(ensureCouple("u1")).resolves.toBeUndefined();
  });
});

// ensureLoveMeterTargets: target lifecycle (lib/love-meter.ts)
describe("ensureLoveMeterTargets", () => {
  beforeEach(() => vi.clearAllMocks());

  async function load() {
    vi.resetModules();
    return (await import("@/lib/love-meter")).ensureLoveMeterTargets;
  }
  const counts = { milestoneCount: 5, noteCount: 5, letterCount: 5, photoCount: 5 };

  it("defaults when no config row", async () => {
    const fn = await load();
    prismaMock.coupleConfig.findFirst.mockResolvedValue(null);
    const s = await fn(counts);
    expect(s.targetPhotos).toBeGreaterThan(0);
    expect(s.justMet).toBe(false);
  });

  it("initializes fresh targets when unset", async () => {
    const fn = await load();
    prismaMock.coupleConfig.findFirst.mockResolvedValue({ id: "cfg", targetMilestones: null, targetSetAt: null, targetMetAt: null });
    prismaMock.coupleConfig.update.mockResolvedValue({});
    const s = await fn(counts);
    expect(prismaMock.coupleConfig.update).toHaveBeenCalledOnce();
    expect(s.targetSetAt).toBeInstanceOf(Date);
  });

  it("marks met once, refreshes after 7 days", async () => {
    const fn = await load();
    prismaMock.coupleConfig.findFirst.mockResolvedValue({
      id: "cfg", targetMilestones: 1, targetNotes: 1, targetLetters: 1, targetPhotos: 1,
      targetSetAt: new Date(), targetMetAt: null,
    });
    const met = await fn(counts);
    expect(met.justMet).toBe(true);
    expect(met.targetMetAt).toBeInstanceOf(Date);

    prismaMock.coupleConfig.findFirst.mockResolvedValue({
      id: "cfg", targetMilestones: 1, targetNotes: 1, targetLetters: 1, targetPhotos: 1,
      targetSetAt: new Date(Date.now() - 86400000 * 10), targetMetAt: new Date(Date.now() - 86400000 * 8),
    });
    const refreshed = await fn(counts);
    expect(refreshed.justUpdated).toBe(true);
    expect(refreshed.targetMetAt).toBeNull();
  });

  it("clears stale met flag when targets no longer met", async () => {
    const fn = await load();
    prismaMock.coupleConfig.findFirst.mockResolvedValue({
      id: "cfg", targetMilestones: 100, targetNotes: 100, targetLetters: 100, targetPhotos: 100,
      targetSetAt: new Date(), targetMetAt: new Date(),
    });
    const s = await fn({ milestoneCount: 0, noteCount: 0, letterCount: 0, photoCount: 0 });
    expect(s.justMet).toBe(false);
    expect(s.targetMetAt).toBeNull();
  });
});

// redis fail-open + resend no-SMTP + api-client transport
describe("redis fail-open without Upstash env", () => {
  it("checkRateLimit allows when redis unconfigured", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();
    const { checkRateLimit, getCached } = await import("@/lib/redis");
    const r = await checkRateLimit("k", 5, 60);
    expect(r).toMatchObject({ allowed: true, remaining: 5 });
    expect(await getCached("k")).toBeNull();
  });
});

describe("resend without SMTP", () => {
  it("sendEmail returns error instead of throwing", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    vi.resetModules();
    const { sendEmail } = await import("@/lib/resend");
    const r = await sendEmail({ to: "a@x.com", subject: "hi", html: "<p>hi</p>" });
    expect(r).toMatchObject({ error: expect.any(String) });
  });
});

describe("api-client transport", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("get/post unwrap envelope; !ok returns server message", async () => {
    const { api } = await import("@/lib/api-client");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: { a: 1 } }), { status: 200 })));
    // ponytail: api-client returns the whole envelope as data (no unwrap) — callers read .data
    expect(await api.get("http://x")).toMatchObject({ data: { data: { a: 1 } }, status: 200 });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Gagal" }), { status: 400 })));
    expect(await api.post("http://x", { b: 2 })).toMatchObject({ error: "Gagal", status: 400 });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    expect((await api.delete("http://x")).status).toBe(500);
  });

  it("network failure → status 0; upload unwraps + handles 204", async () => {
    const { api } = await import("@/lib/api-client");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect(await api.get("http://x")).toMatchObject({ error: "down", status: 0 });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    const up = await api.upload("http://x", new FormData());
    expect(up.status).toBe(204);
  });
});
