import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/redis", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 2, reset: 0 })),
}));
vi.mock("@/lib/rate-limit", () => ({
  withAnonymousRateLimit: vi.fn(async () => ({ allowed: true, remaining: 9 })),
}));
vi.mock("@/lib/auth", () => ({ ensureCouple: vi.fn(async () => {}) }));

const { POST } = await import("@/app/api/auth/register/route");
const { checkRateLimit } = await import("@/lib/redis");
const { withAnonymousRateLimit } = await import("@/lib/rate-limit");
const { ensureCouple } = await import("@/lib/auth");

// AUTH-01/02/03 + 400/409 matrix (mocked Prisma, no live DB)
describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INVITE_TOKEN = "test-invite-123";
    vi.mocked(withAnonymousRateLimit).mockResolvedValue({ allowed: true, remaining: 9 });
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 2, reset: 0 });
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.user.create.mockResolvedValue({ id: "u1", name: "A", email: "a@test.com" });
  });

  function req(body: unknown) {
    return new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("AUTH-01: 201 happy path + ensureCouple called", async () => {
    const res = await POST(req({ name: "A", email: "A@test.com", password: "supersecret123", inviteToken: "test-invite-123" }));
    expect(res.status).toBe(201);
    expect(prismaMock.user.create).toHaveBeenCalledOnce();
    expect(ensureCouple).toHaveBeenCalledWith("u1");
  });

  it("AUTH-02: wrong invite → 403", async () => {
    const res = await POST(req({ name: "A", email: "a@test.com", password: "supersecret123", inviteToken: "wrong" }));
    expect(res.status).toBe(403);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("AUTH-03: third partner → 403 quota", async () => {
    prismaMock.user.count.mockResolvedValue(2);
    const res = await POST(req({ name: "C", email: "c@test.com", password: "supersecret123", inviteToken: "test-invite-123" }));
    expect(res.status).toBe(403);
  });

  it("400 on invalid body", async () => {
    const bad = await POST(req({ name: "", email: "not-email", password: "123", inviteToken: "test-invite-123" }));
    expect(bad.status).toBe(400);
  });

  it("409 on duplicate email", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "dup" });
    const dup = await POST(req({ name: "A", email: "a@test.com", password: "supersecret123", inviteToken: "test-invite-123" }));
    expect(dup.status).toBe(409);
  });

  it("429 when rate-limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0, reset: 1 });
    const res = await POST(req({ name: "A", email: "a@test.com", password: "supersecret123", inviteToken: "test-invite-123" }));
    expect(res.status).toBe(429);
  });
});
