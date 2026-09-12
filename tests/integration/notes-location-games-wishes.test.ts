import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  dailyNote: { create: vi.fn(), findMany: vi.fn() },
  coupleMember: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/redis", () => ({
  getCached: vi.fn(async () => null),
  setCached: vi.fn(async () => {}),
  invalidateCache: vi.fn(async () => {}),
  cacheKey: (...p: string[]) => p.join(":"),
}));
vi.mock("@/lib/rate-limit", () => ({
  withRateLimit: vi.fn(async () => ({ allowed: true, remaining: 99, session: { user: { id: "user-a" } } })),
  rateLimitConfigs: { note: {}, write: {}, score: {}, location: {} },
}));
vi.mock("@/lib/batch", () => ({
  batchLoadUsers: vi.fn(async () => new Map()),
  toPublicUser: vi.fn((u: unknown) => u),
}));
vi.mock("@/lib/couple", () => ({ getUserCoupleId: vi.fn(async () => null) }));
vi.mock("@/lib/pusher-server", () => ({ triggerCoupleEvent: vi.fn() }));
vi.mock("@/lib/resend", () => ({ sendEmail: vi.fn(), noteNotificationHtml: () => "<p>n</p>" }));

const { POST: postNote } = await import("@/app/api/notes/route");
const { GET: getLocation } = await import("@/app/api/location/route");
const { auth } = await import("@/lib/auth");

// NOTE-01/02, LOC consent shape, GAM arcade enum, WISH done
describe("notes / location / games / wishes contracts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("NOTE-01: POST 400 when >280 chars (validates before DB)", async () => {
    const res = await postNote(new Request("http://localhost/api/notes", { method: "POST", body: JSON.stringify({ content: "a".repeat(281) }) }));
    expect(res.status).toBe(400);
    expect(prismaMock.dailyNote.create).not.toHaveBeenCalled();
  });

  it("LOC-02: unauthenticated GET → 401 (consent enforced at route)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await getLocation();
    expect(res.status).toBe(401);
  });

  it("GAM-04: arcade rejects negative score at schema level", async () => {
    const { submitArcadeScoreSchema } = await import("@/lib/validations/game");
    expect(submitArcadeScoreSchema.safeParse({ gameType: "SLIDING_PUZZLE", score: -5 }).success).toBe(false);
    expect(submitArcadeScoreSchema.safeParse({ gameType: "MEMORY_BLOCK_BLAST", score: 42 }).success).toBe(true);
  });

  it("WISH-01: update schema allows isDone toggle", async () => {
    const { updateWishSchema } = await import("@/lib/validations/wish");
    expect(updateWishSchema.safeParse({ isDone: true }).success).toBe(true);
    expect(updateWishSchema.safeParse({ title: "" }).success).toBe(false);
  });
});
