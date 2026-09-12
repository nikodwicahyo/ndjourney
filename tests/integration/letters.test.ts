import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  coupleMember: { findUnique: vi.fn() },
  letter: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
}));

// cuid() rejects hyphens — use cuid-shaped ids
const ME = "cjld2cjxh0000qz8n0p3q4w5e1";
const PARTNER = "cjld2cjxh0000qz8n0p3q4w5e2";
const OUTSIDER = "cjld2cjxh0000qz8n0p3q4w5e3";

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/redis", () => ({
  getCached: vi.fn(async () => null),
  setCached: vi.fn(async () => {}),
  invalidateCache: vi.fn(async () => {}),
  cacheKey: (...p: string[]) => p.join(":"),
}));
vi.mock("@/lib/rate-limit", () => ({
  withRateLimit: vi.fn(),
  rateLimitConfigs: { letter: { maxRequests: 30, windowSeconds: 3600 } },
}));
vi.mock("@/lib/batch", () => ({
  batchLoadUsers: vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, { id, name: "P", image: null }]))),
  mapUsersToRecords: vi.fn((rows: unknown[]) => rows),
}));
vi.mock("@/lib/resend", () => ({ sendEmail: vi.fn(), letterNotificationHtml: () => "<p>x</p>" }));
vi.mock("@/lib/pusher-server", () => ({ triggerCoupleEvent: vi.fn() }));
vi.mock("@/lib/couple", () => ({ getUserCoupleId: vi.fn(async () => null) }));

const { POST } = await import("@/app/api/letters/route");
const { GET, DELETE } = await import("@/app/api/letters/[id]/route");
const { auth } = await import("@/lib/auth");
const { withRateLimit } = await import("@/lib/rate-limit");

describe("letters API contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(withRateLimit).mockResolvedValue({ allowed: true, remaining: 29, session: { user: { id: ME } } } as never);
    vi.mocked(auth).mockResolvedValue({ user: { id: ME } } as never);
  });

  it("LTR-01: POST creates letter for valid couple recipient (time-capsule skips after())", async () => {
    prismaMock.coupleMember.findUnique.mockResolvedValue({ couple: { id: "couple-1", members: [{ userId: PARTNER }] } });
    prismaMock.letter.create.mockResolvedValue({ id: "l1", authorId: ME, recipientId: PARTNER });
    const res = await POST(
      new Request("http://localhost/api/letters", {
        method: "POST",
        body: JSON.stringify({
          title: "Hai", content: "<p>cinta</p>", recipientId: PARTNER,
          mood: "LOVE", isTimeCapsule: true, unlockAt: new Date(Date.now() + 86400000).toISOString(), isPublic: false,
        }),
      }),
    );
    expect(res.status).toBe(201);
  });

  it("LTR-02: POST 400 on invalid", async () => {
    const bad = await POST(new Request("http://localhost/api/letters", { method: "POST", body: JSON.stringify({ title: "" }) }));
    expect(bad.status).toBe(400);
  });

  it("LTR-02b: POST 403 on non-partner recipient", async () => {
    prismaMock.coupleMember.findUnique.mockResolvedValue({ couple: { id: "couple-1", members: [{ userId: PARTNER }] } });
    const forbidden = await POST(
      new Request("http://localhost/api/letters", {
        method: "POST",
        body: JSON.stringify({ title: "t", content: "c", recipientId: OUTSIDER, mood: "LOVE" }),
      }),
    );
    expect(forbidden.status).toBe(403);
  });

  it("LTR-04/SEC-06: GET locked capsule hides content; outsider 403; missing 404", async () => {
    const future = new Date(Date.now() + 86400000);
    prismaMock.letter.findUnique.mockResolvedValue({
      id: "l1", title: "Secret", content: "<p>rahasia</p>", authorId: ME, recipientId: PARTNER,
      isTimeCapsule: true, unlockAt: future, isOpened: false, openedAt: null,
      mood: "LOVE", isPublic: false, createdAt: new Date(), updatedAt: new Date(),
    });
    vi.mocked(auth).mockResolvedValue({ user: { id: PARTNER } } as never);
    const locked = await GET(new Request("http://localhost/api/letters/l1"), { params: Promise.resolve({ id: "l1" }) });
    expect(locked.status).toBe(200);
    const body = await locked.json();
    expect(body.data.content).toBeUndefined();
    expect(body.data.unlockAt).toBeDefined();

    vi.mocked(auth).mockResolvedValue({ user: { id: OUTSIDER } } as never);
    const forbidden = await GET(new Request("http://localhost/api/letters/l1"), { params: Promise.resolve({ id: "l1" }) });
    expect(forbidden.status).toBe(403);

    prismaMock.letter.findUnique.mockResolvedValue(null);
    vi.mocked(auth).mockResolvedValue({ user: { id: ME } } as never);
    const missing = await GET(new Request("http://localhost/api/letters/x"), { params: Promise.resolve({ id: "x" }) });
    expect(missing.status).toBe(404);
  });

  it("DELETE: only author can delete (SEC-06)", async () => {
    prismaMock.letter.findUnique.mockResolvedValue({ id: "l1", authorId: ME });
    vi.mocked(auth).mockResolvedValue({ user: { id: OUTSIDER } } as never);
    const forbidden = await DELETE(new Request("http://localhost/api/letters/l1", { method: "DELETE" }), { params: Promise.resolve({ id: "l1" }) });
    expect(forbidden.status).toBe(403);

    vi.mocked(auth).mockResolvedValue({ user: { id: ME } } as never);
    const ok = await DELETE(new Request("http://localhost/api/letters/l1", { method: "DELETE" }), { params: Promise.resolve({ id: "l1" }) });
    expect(ok.status).toBe(200);
    expect(prismaMock.letter.delete).toHaveBeenCalledWith({ where: { id: "l1" } });
  });

  it("401 without session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await GET(new Request("http://localhost/api/letters/l1"), { params: Promise.resolve({ id: "l1" }) });
    expect(res.status).toBe(401);
  });
});
