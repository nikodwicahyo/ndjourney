import { describe, it, expect, vi, beforeEach } from "vitest";

const ME = "cjld2cjxh0000qz8n0p3q4w5e1";
const COUPLE = "couple-1";
const QID = "cjld2cjxh0000qz8n0p3q4w5eq";

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  gameQuestion: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  gameScore: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), count: vi.fn() },
  gameArcadeScore: { create: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  withRateLimit: vi.fn(),
  withAnonymousRateLimit: vi.fn(),
  rateLimitConfigs: { write: {}, score: {} },
}));
vi.mock("@/lib/redis", () => ({
  getCached: vi.fn(async () => null),
  setCached: vi.fn(async () => {}),
  invalidateCache: vi.fn(async () => {}),
  cacheKey: (...p: string[]) => p.join(":"),
}));
vi.mock("@/lib/couple", () => ({ getUserCoupleId: vi.fn(async () => COUPLE) }));
vi.mock("@/lib/pusher-server", () => ({ triggerCoupleEvent: vi.fn() }));
vi.mock("@/lib/batch", () => ({
  batchLoadUsers: vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, { id, name: "P", email: "p@x.com", image: null }]))),
  toPublicUser: vi.fn((u: { id: string; name: string | null; image: string | null }) => ({ id: u.id, name: u.name, image: u.image })),
}));

const questions = await import("@/app/api/games/questions/route");
const questionById = await import("@/app/api/games/questions/[id]/route");
const score = await import("@/app/api/games/score/route");
const leaderboard = await import("@/app/api/games/leaderboard/route");
const arcadeScore = await import("@/app/api/games/arcade-score/route");
const arcadeBoard = await import("@/app/api/games/arcade-leaderboard/route");
const { auth } = await import("@/lib/auth");
const { withRateLimit, withAnonymousRateLimit } = await import("@/lib/rate-limit");

function allowAuthed(userId: string = ME) {
  vi.mocked(auth).mockResolvedValue({ user: { id: userId } } as never);
  vi.mocked(withRateLimit).mockResolvedValue({ allowed: true, remaining: 99, session: { user: { id: userId } } } as never);
  vi.mocked(withAnonymousRateLimit).mockResolvedValue({ allowed: true, remaining: 99 });
}

describe("games questions API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allowAuthed();
  });

  it("GAM: GET public list 200 (no auth needed)", async () => {
    prismaMock.gameQuestion.findMany.mockResolvedValue([{ id: QID }]);
    const res = await questions.GET(new Request("http://localhost/api/games/questions?type=TRIVIA"));
    expect(res.status).toBe(200);
  });

  it("GAM-01: POST 201 TRIVIA, 400 invalid, 403 no-couple", async () => {
    prismaMock.gameQuestion.create.mockResolvedValue({ id: QID });
    const ok = await questions.POST(new Request("http://localhost/api/games/questions", {
      method: "POST", body: JSON.stringify({ type: "TRIVIA", question: "Makanan favorit?", answer: "Rendang" }),
    }));
    expect(ok?.status).toBe(201);
    const bad = await questions.POST(new Request("http://localhost/api/games/questions", {
      method: "POST", body: JSON.stringify({ type: "TRIVIA", question: "" }),
    }));
    expect(bad.status).toBe(400);
    const { getUserCoupleId } = await import("@/lib/couple");
    vi.mocked(getUserCoupleId).mockResolvedValueOnce(null);
    const nocouple = await questions.POST(new Request("http://localhost/api/games/questions", {
      method: "POST", body: JSON.stringify({ type: "TRIVIA", question: "Q?", answer: "A" }),
    }));
    expect(nocouple.status).toBe(403);
  });

  it("questions/[id] PUT 200 + DELETE archive-vs-delete", async () => {
    prismaMock.gameQuestion.update.mockResolvedValue({ id: QID });
    const put = await questionById.PUT(new Request("http://localhost/api/games/questions/x", {
      method: "PUT",
      body: JSON.stringify({ type: "TRIVIA", question: "Q2?", answer: "B" }),
    }), { params: Promise.resolve({ id: QID }) });
    expect(put.status).toBe(200);

    prismaMock.gameScore.count.mockResolvedValue(3);
    const archived = await questionById.DELETE(new Request("http://localhost/api/games/questions/x", { method: "DELETE" }), { params: Promise.resolve({ id: QID }) });
    expect(archived.status).toBe(200);
    expect(prismaMock.gameQuestion.update).toHaveBeenCalledWith(expect.objectContaining({ data: { isArchived: true } }));

    prismaMock.gameScore.count.mockResolvedValue(0);
    prismaMock.gameQuestion.delete.mockResolvedValue({ id: QID });
    const deleted = await questionById.DELETE(new Request("http://localhost/api/games/questions/x", { method: "DELETE" }), { params: Promise.resolve({ id: QID }) });
    expect(deleted.status).toBe(200);
    expect(prismaMock.gameQuestion.delete).toHaveBeenCalledOnce();
  });
});

describe("games scores + leaderboards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allowAuthed();
  });

  it("GAM-02: score 201, duplicate 409, anon needs playerName", async () => {
    prismaMock.gameScore.findFirst.mockResolvedValue(null);
    prismaMock.gameScore.create.mockResolvedValue({ id: "s1" });
    const ok = await score.POST(new Request("http://localhost/api/games/score", {
      method: "POST", body: JSON.stringify({ questionId: QID, isCorrect: true }),
    }));
    expect(ok?.status).toBe(201);

    prismaMock.gameScore.findFirst.mockResolvedValue({ id: "s1" });
    const dup = await score.POST(new Request("http://localhost/api/games/score", {
      method: "POST", body: JSON.stringify({ questionId: QID, isCorrect: false }),
    }));
    expect(dup?.status).toBe(409);

    vi.mocked(auth).mockResolvedValue(null as never);
    const anon = await score.POST(new Request("http://localhost/api/games/score", {
      method: "POST", body: JSON.stringify({ questionId: QID, isCorrect: true }),
    }));
    expect(anon?.status).toBe(400);
    prismaMock.gameScore.findFirst.mockResolvedValue(null);
    const anonOk = await score.POST(new Request("http://localhost/api/games/score", {
      method: "POST", body: JSON.stringify({ questionId: QID, isCorrect: true, playerName: "Tamu" }),
    }));
    expect(anonOk?.status).toBe(201);
  });

  it("GAM-03: leaderboard 200 + invalid type 400", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ userId: ME, totalPlayed: BigInt(2), totalCorrect: BigInt(1) }]);
    const ok = await leaderboard.GET(new Request("http://localhost/api/games/leaderboard") as unknown as Parameters<typeof leaderboard.GET>[0]);
    expect(ok?.status).toBe(200);
    const body = await ok.json();
    expect(body.data[0]).toMatchObject({ totalPlayed: 2, totalCorrect: 1, accuracy: 50 });
    const bad = await leaderboard.GET(new Request("http://localhost/api/games/leaderboard?type=NOPE") as unknown as Parameters<typeof leaderboard.GET>[0]);
    expect(bad.status).toBe(400);
  });

  it("GAM-04: arcade-score 201 + metadata cap 400 + board requires type", async () => {
    prismaMock.gameArcadeScore.create.mockResolvedValue({ id: "a1" });
    const ok = await arcadeScore.POST(new Request("http://localhost/api/games/arcade-score", {
      method: "POST", body: JSON.stringify({ gameType: "SLIDING_PUZZLE", score: 100 }),
    }));
    expect(ok?.status).toBe(201);
    const big = await arcadeScore.POST(new Request("http://localhost/api/games/arcade-score", {
      method: "POST", body: JSON.stringify({ gameType: "SLIDING_PUZZLE", score: 1, metadata: { blob: "x".repeat(5000) } }),
    }));
    expect(big?.status).toBe(400);

    prismaMock.$queryRaw.mockResolvedValue([]);
    const board = await arcadeBoard.GET(new Request("http://localhost/api/games/arcade-leaderboard?type=MEMORY_BLOCK_BLAST") as unknown as Parameters<typeof arcadeBoard.GET>[0]);
    expect(board?.status).toBe(200);
    const missing = await arcadeBoard.GET(new Request("http://localhost/api/games/arcade-leaderboard") as unknown as Parameters<typeof arcadeBoard.GET>[0]);
    expect(missing?.status).toBe(400);
  });
});
