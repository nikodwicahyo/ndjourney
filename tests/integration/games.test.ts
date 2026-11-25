import { describe, it, expect, vi, beforeEach } from "vitest";
import { GAME_QUESTION_MAX_LIMIT } from "@/lib/utils";

const ME = "cjld2cjxh0000qz8n0p3q4w5e1";
const COUPLE = "couple-1";
const QID = "cjld2cjxh0000qz8n0p3q4w5eq";
const QID2 = "cjld2cjxh0000qz8n0p3q4w5er";
const ROUND_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $queryRawUnsafe: vi.fn(),
  gameQuestion: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), count: vi.fn(async () => 0), groupBy: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  gameScore: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), count: vi.fn() },
  gameArcadeScore: { create: vi.fn() },
  gameRound: { create: vi.fn(), findUnique: vi.fn() },
  hiddenLeaderboardPlayer: {
    findMany: vi.fn(
      async (): Promise<{ playerKey: string; label: string; hiddenAt: Date }[]> => [],
    ),
    upsert: vi.fn(
      async (): Promise<{ playerKey: string; label: string; hiddenAt: Date }> => ({
        playerKey: "",
        label: "",
        hiddenAt: new Date(0),
      }),
    ),
    deleteMany: vi.fn(async () => ({ count: 0 })),
  },
  user: { findUnique: vi.fn(async (): Promise<{ name: string | null } | null> => null) },
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
vi.mock("@/lib/activity", () => ({ emitActivity: vi.fn() }));
vi.mock("@/lib/pusher-server", () => ({ triggerCoupleEvent: vi.fn() }));
vi.mock("@/lib/batch", () => ({
  batchLoadUsers: vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, { id, name: "P", email: "p@x.com", image: null }]))),
  toPublicUser: vi.fn((u: { id: string; name: string | null; image: string | null }) => ({ id: u.id, name: u.name, image: u.image })),
}));

const questions = await import("@/app/api/games/questions/route");
const questionCounts = await import("@/app/api/games/questions/counts/route");
const questionById = await import("@/app/api/games/questions/[id]/route");
const score = await import("@/app/api/games/score/route");
const leaderboard = await import("@/app/api/games/leaderboard/route");
const arcadeScore = await import("@/app/api/games/arcade-score/route");
const arcadeBoard = await import("@/app/api/games/arcade-leaderboard/route");
const round = await import("@/app/api/games/round/route");
const hiddenPlayers = await import("@/app/api/games/leaderboard/hidden/route");
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

  it("GAM: dashboard may fetch the whole bank, public callers stay capped", async () => {
    prismaMock.gameQuestion.findMany.mockResolvedValue([]);

    await questions.GET(new Request("http://localhost/api/games/questions?type=TRIVIA&limit=2000&includeAnswer=1"));
    let take = prismaMock.gameQuestion.findMany.mock.calls.at(-1)?.[0]?.take;
    expect(take).toBe(GAME_QUESTION_MAX_LIMIT);

    vi.mocked(auth).mockResolvedValue(null as never);
    await questions.GET(new Request("http://localhost/api/games/questions?type=TRIVIA&limit=2000"));
    take = prismaMock.gameQuestion.findMany.mock.calls.at(-1)?.[0]?.take;
    expect(take).toBe(200);
  });

  it("GAM: counts route returns per-type active totals", async () => {
    prismaMock.gameQuestion.groupBy.mockResolvedValue([
      { type: "TRIVIA", _count: { _all: 12 } },
      { type: "WOULD_YOU_RATHER", _count: { _all: 7 } },
    ]);

    const res = await questionCounts.GET();
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ TRIVIA: 12, WOULD_YOU_RATHER: 7 });
    expect(prismaMock.gameQuestion.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ["type"], where: { isArchived: false } }),
    );
  });

  it("GAM: questions/[id] GET resolves a deep link, answer only for a couple member", async () => {
    prismaMock.gameQuestion.findFirst.mockResolvedValue({ id: QID, type: "TRIVIA", question: "Q?", answer: "A" });
    const url = `http://localhost/api/games/questions/${QID}`;
    const params = { params: Promise.resolve({ id: QID }) };

    const res = await questionById.GET(new Request(url), params);
    expect(res.status).toBe(200);
    expect((await res.json()).data.id).toBe(QID);
    expect(prismaMock.gameQuestion.findFirst.mock.calls.at(-1)?.[0]?.select?.answer).toBe(true);

    vi.mocked(auth).mockResolvedValue(null as never);
    await questionById.GET(new Request(url), params);
    expect(prismaMock.gameQuestion.findFirst.mock.calls.at(-1)?.[0]?.select?.answer).toBeUndefined();

    prismaMock.gameQuestion.findFirst.mockResolvedValue(null);
    const missing = await questionById.GET(new Request(url), params);
    expect(missing.status).toBe(404);
  });

  it("MR-12: GET random prefetches bounded rows (no full-bank load)", async () => {
    prismaMock.gameScore.findMany.mockResolvedValue([]);
    prismaMock.gameQuestion.findMany.mockResolvedValue([{ id: QID }]);
    prismaMock.gameQuestion.count.mockResolvedValue(1);
    const res = await questions.GET(new Request("http://localhost/api/games/questions?type=TRIVIA&random=10"));
    expect(res.status).toBe(200);
    // bounded prefetch: at most 3x the clamped count, never unbounded
    for (const call of prismaMock.gameQuestion.findMany.mock.calls) {
      const take = (call[0] as { take?: number }).take;
      if (take !== undefined) expect(take).toBeLessThanOrEqual(150);
    }
    expect(prismaMock.gameQuestion.count).toHaveBeenCalled();
    const body = await res.json();
    expect(body.total).toBe(1);
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

  it("questions/[id] PUT 200 + DELETE archive-vs-delete, 403 without a couple", async () => {
    const { getUserCoupleId } = await import("@/lib/couple");
    vi.mocked(getUserCoupleId).mockResolvedValueOnce(null);
    const noCouple = await questionById.PUT(new Request("http://localhost/api/games/questions/x", {
      method: "PUT",
      body: JSON.stringify({ type: "TRIVIA", question: "Q?" }),
    }), { params: Promise.resolve({ id: QID }) });
    expect(noCouple.status).toBe(403);

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

    vi.mocked(getUserCoupleId).mockResolvedValueOnce(null);
    const deleteNoCouple = await questionById.DELETE(new Request("http://localhost/api/games/questions/x", { method: "DELETE" }), { params: Promise.resolve({ id: QID }) });
    expect(deleteNoCouple.status).toBe(403);
  });
});

describe("games scores + leaderboards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allowAuthed();
  });

  it("GAM-02: score is server-graded, duplicate returns recorded result, anon needs playerName", async () => {
    prismaMock.gameQuestion.findUnique.mockResolvedValue({ type: "TRIVIA", answer: "Rendang", isArchived: false });
    prismaMock.gameScore.findFirst.mockResolvedValue(null);
    prismaMock.gameScore.create.mockResolvedValue({ id: "s1" });

    // Client claims nothing: the stored answer decides.
    const wrong = await score.POST(new Request("http://localhost/api/games/score", {
      method: "POST", body: JSON.stringify({ questionId: QID, selectedAnswer: "Sate" }),
    }));
    expect(wrong?.status).toBe(201);
    expect(prismaMock.gameScore.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isCorrect: false }) }),
    );
    const wrongBody = await wrong?.json();
    expect(wrongBody).toMatchObject({ correct: false, answer: "Rendang" });

    prismaMock.gameScore.findFirst.mockResolvedValue(null);
    const right = await score.POST(new Request("http://localhost/api/games/score", {
      method: "POST", body: JSON.stringify({ questionId: QID, selectedAnswer: "  rendang " }),
    }));
    expect(right?.status).toBe(201);
    expect(prismaMock.gameScore.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isCorrect: true }) }),
    );

    // A forgeable `isCorrect` field is ignored entirely.
    const forged = await score.POST(new Request("http://localhost/api/games/score", {
      method: "POST", body: JSON.stringify({ questionId: QID, isCorrect: true }),
    }));
    expect(forged?.status).toBe(400);

    prismaMock.gameScore.findFirst.mockResolvedValue({ id: "s1", isCorrect: false });
    const dup = await score.POST(new Request("http://localhost/api/games/score", {
      method: "POST", body: JSON.stringify({ questionId: QID, selectedAnswer: "Rendang" }),
    }));
    expect(dup?.status).toBe(200);
    expect(await dup?.json()).toMatchObject({ correct: false, answer: "Rendang" });

    vi.mocked(auth).mockResolvedValue(null as never);
    const anon = await score.POST(new Request("http://localhost/api/games/score", {
      method: "POST", body: JSON.stringify({ questionId: QID, selectedAnswer: "Rendang" }),
    }));
    expect(anon?.status).toBe(400);
    prismaMock.gameScore.findFirst.mockResolvedValue(null);
    const anonOk = await score.POST(new Request("http://localhost/api/games/score", {
      method: "POST", body: JSON.stringify({ questionId: QID, selectedAnswer: "Rendang", playerName: "Tamu" }),
    }));
    expect(anonOk?.status).toBe(201);
  });

  it("GAM-02b: answer key is only returned to a scoped dashboard caller", async () => {
    prismaMock.gameQuestion.findMany.mockResolvedValue([{ id: QID }]);

    await questions.GET(new Request("http://localhost/api/games/questions?type=TRIVIA"));
    let select = prismaMock.gameQuestion.findMany.mock.calls.at(-1)?.[0]?.select;
    expect(select?.answer).toBeUndefined();

    vi.mocked(auth).mockResolvedValue(null as never);
    await questions.GET(new Request("http://localhost/api/games/questions?type=TRIVIA&includeAnswer=1"));
    select = prismaMock.gameQuestion.findMany.mock.calls.at(-1)?.[0]?.select;
    expect(select?.answer).toBeUndefined();

    vi.mocked(auth).mockResolvedValue({ user: { id: ME } } as never);
    const { getUserCoupleId } = await import("@/lib/couple");
    vi.mocked(getUserCoupleId).mockResolvedValue(COUPLE);
    await questions.GET(new Request("http://localhost/api/games/questions?type=TRIVIA&includeAnswer=1"));
    select = prismaMock.gameQuestion.findMany.mock.calls.at(-1)?.[0]?.select;
    expect(select?.answer).toBe(true);
  });

  it("GAM-03: 2x main means 2 completed rounds, not 2 answered questions", async () => {
    // Merged "Semua" tab: QA aggregate first, arcade aggregate second.
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([
        { userId: ME, gameType: "WOULD_YOU_RATHER", plays: BigInt(2), correct: BigInt(1), answered: BigInt(20) },
      ])
      .mockResolvedValueOnce([
        { userId: ME, gameType: "SLIDING_PUZZLE", plays: BigInt(3), totalScore: BigInt(500), bestScore: BigInt(300), avgScore: BigInt(166) },
      ]);
    const ok = await leaderboard.GET(new Request("http://localhost/api/games/leaderboard") as unknown as Parameters<typeof leaderboard.GET>[0]);
    expect(ok?.status).toBe(200);
    const body = await ok?.json();
    expect(body.data[0]).toMatchObject({
      totalPlayed: 5, // 2 quiz rounds + 3 arcade runs
      totalCorrect: 1,
      totalAnswered: 20,
      accuracy: 5,
      totalScore: 1500, // 1 correct × 1000 + 500 arcade
      bestScore: 300,
    });
    expect(body.data[0].games).toHaveLength(2);
    const bad = await leaderboard.GET(new Request("http://localhost/api/games/leaderboard?type=NOPE") as unknown as Parameters<typeof leaderboard.GET>[0]);
    expect(bad?.status).toBe(400);
  });

  it("GAM-03b: per-game tab reports that game's plays and score", async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([
      { userId: ME, gameType: "TRIVIA", plays: BigInt(4), correct: BigInt(30), answered: BigInt(40) },
    ]);
    const res = await leaderboard.GET(new Request("http://localhost/api/games/leaderboard?type=TRIVIA") as unknown as Parameters<typeof leaderboard.GET>[0]);
    const body = await res?.json();
    expect(body.data[0]).toMatchObject({
      totalPlayed: 4,
      totalCorrect: 30,
      totalAnswered: 40,
      accuracy: 75,
      totalScore: 30000,
    });
    // Only the round ledger is queried for a quiz tab — never GameScore.
    expect(prismaMock.$queryRawUnsafe).toHaveBeenCalledTimes(1);

    // Regression: the hide-player filter must be part of the SQL string, not a
    // bound nested Sql object (Prisma 22P02 → API 500 → false "Belum ada skor").
    const [sql, ...params] = prismaMock.$queryRawUnsafe.mock.calls[0];
    expect(sql).toContain('FROM "GameRound"');
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('"HiddenLeaderboardPlayer"');
    expect(params.every((p) => typeof p === "string")).toBe(true);
  });

  it("GAM-05: completed round derives its score server-side and is idempotent", async () => {
    prismaMock.gameQuestion.findMany.mockResolvedValue([
      { id: QID, type: "TRIVIA" },
      { id: QID2, type: "TRIVIA" },
    ]);
    prismaMock.gameScore.findMany.mockResolvedValue([{ isCorrect: true }, { isCorrect: false }]);
    prismaMock.gameRound.create.mockResolvedValue({
      id: "r1", gameType: "TRIVIA", correct: 1, totalQuestions: 2, playedAt: new Date(),
    });

    const ok = await round.POST(new Request("http://localhost/api/games/round", {
      method: "POST",
      body: JSON.stringify({ gameType: "TRIVIA", roundId: ROUND_ID, questionIds: [QID, QID2] }),
    }));
    expect(ok?.status).toBe(201);
    expect(prismaMock.gameRound.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          correct: 1,
          totalQuestions: 2,
          dedupeKey: `user:${ME}:${ROUND_ID}`,
        }),
      }),
    );

    // A retried submit returns the recorded round instead of double counting.
    prismaMock.gameRound.create.mockRejectedValueOnce({ code: "P2002" });
    prismaMock.gameRound.findUnique.mockResolvedValue({
      id: "r1", gameType: "TRIVIA", correct: 1, totalQuestions: 2, playedAt: new Date(),
    });
    const dup = await round.POST(new Request("http://localhost/api/games/round", {
      method: "POST",
      body: JSON.stringify({ gameType: "TRIVIA", roundId: ROUND_ID, questionIds: [QID, QID2] }),
    }));
    expect(dup?.status).toBe(200);

    // Question from another game type is rejected.
    prismaMock.gameQuestion.findMany.mockResolvedValue([{ id: QID, type: "WOULD_YOU_RATHER" }]);
    const wrongType = await round.POST(new Request("http://localhost/api/games/round", {
      method: "POST",
      body: JSON.stringify({ gameType: "TRIVIA", roundId: ROUND_ID, questionIds: [QID] }),
    }));
    expect(wrongType?.status).toBe(400);

    // No recorded answers for the batch → nothing to count.
    prismaMock.gameQuestion.findMany.mockResolvedValue([{ id: QID, type: "TRIVIA" }]);
    prismaMock.gameScore.findMany.mockResolvedValue([]);
    const noAnswers = await round.POST(new Request("http://localhost/api/games/round", {
      method: "POST",
      body: JSON.stringify({ gameType: "TRIVIA", roundId: ROUND_ID, questionIds: [QID] }),
    }));
    expect(noAnswers?.status).toBe(409);
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
    const impossible = await arcadeScore.POST(new Request("http://localhost/api/games/arcade-score", {
      method: "POST", body: JSON.stringify({ gameType: "MEMORY_BLOCK_BLAST", score: 99_999_999 }),
    }));
    expect(impossible?.status).toBe(400);

    prismaMock.$queryRawUnsafe.mockResolvedValue([]);
    const board = await arcadeBoard.GET(new Request("http://localhost/api/games/arcade-leaderboard?type=MEMORY_BLOCK_BLAST") as unknown as Parameters<typeof arcadeBoard.GET>[0]);
    expect(board?.status).toBe(200);
    const missing = await arcadeBoard.GET(new Request("http://localhost/api/games/arcade-leaderboard") as unknown as Parameters<typeof arcadeBoard.GET>[0]);
    expect(missing?.status).toBe(400);
  });
});

describe("leaderboard moderation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allowAuthed();
  });

  it("MOD-01: hidden list is couple-member only and returns the stored keys", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await hiddenPlayers.GET()).status).toBe(401);

    allowAuthed();
    const { getUserCoupleId } = await import("@/lib/couple");
    vi.mocked(getUserCoupleId).mockResolvedValueOnce(null);
    expect((await hiddenPlayers.GET()).status).toBe(403);

    prismaMock.hiddenLeaderboardPlayer.findMany.mockResolvedValue([
      { playerKey: "guest:budi", label: "Budi", hiddenAt: new Date("2026-11-25T00:00:00Z") },
    ]);
    const ok = await hiddenPlayers.GET();
    expect(ok.status).toBe(200);
    expect((await ok.json()).data[0]).toMatchObject({ playerKey: "guest:budi", label: "Budi" });
  });

  it("MOD-02: hiding a guest normalizes the key and drops every board cache", async () => {
    prismaMock.hiddenLeaderboardPlayer.upsert.mockResolvedValue({
      playerKey: "guest:budi", label: "Budi", hiddenAt: new Date(),
    });

    const res = await hiddenPlayers.POST(new Request("http://localhost/api/games/leaderboard/hidden", {
      method: "POST", body: JSON.stringify({ playerName: "  Budi " }),
    }));

    expect(res.status).toBe(200);
    expect(prismaMock.hiddenLeaderboardPlayer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { playerKey: "guest:budi" },
        create: expect.objectContaining({ playerKey: "guest:budi", label: "Budi", hiddenBy: ME }),
      }),
    );
    // Guests have no account to look up.
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    const { invalidateCache } = await import("@/lib/redis");
    expect(invalidateCache).toHaveBeenCalledWith("games:*");
    // Partners' open dashboards must drop their cached board immediately.
    const { triggerCoupleEvent } = await import("@/lib/pusher-server");
    expect(triggerCoupleEvent).toHaveBeenCalledWith(COUPLE, "GAMES_LEADERBOARD");
  });

  it("MOD-03: hiding an account derives the label server-side, never from the client", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ name: "  Budi  " });
    prismaMock.hiddenLeaderboardPlayer.upsert.mockResolvedValue({
      playerKey: `user:${ME}`, label: "Budi", hiddenAt: new Date(),
    });

    const res = await hiddenPlayers.POST(new Request("http://localhost/api/games/leaderboard/hidden", {
      method: "POST", body: JSON.stringify({ userId: ME, label: "Nama Palsu" }),
    }));

    expect(res.status).toBe(200);
    expect(prismaMock.hiddenLeaderboardPlayer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { playerKey: `user:${ME}` },
        create: expect.objectContaining({ label: "Budi" }),
      }),
    );
  });

  it("MOD-04: exactly one identity is required; restore is idempotent", async () => {
    const url = "http://localhost/api/games/leaderboard/hidden";
    const both = await hiddenPlayers.POST(new Request(url, {
      method: "POST", body: JSON.stringify({ userId: ME, playerName: "Budi" }),
    }));
    expect(both.status).toBe(400);

    const neither = await hiddenPlayers.POST(new Request(url, {
      method: "POST", body: JSON.stringify({}),
    }));
    expect(neither.status).toBe(400);

    prismaMock.hiddenLeaderboardPlayer.deleteMany.mockResolvedValue({ count: 0 });
    const restore = await hiddenPlayers.DELETE(new Request(url, {
      method: "DELETE", body: JSON.stringify({ playerKey: "guest:budi" }),
    }));
    expect(restore.status).toBe(200);
    expect(await restore.json()).toEqual({ removed: 0 });
    expect(prismaMock.hiddenLeaderboardPlayer.deleteMany).toHaveBeenCalledWith({
      where: { playerKey: "guest:budi" },
    });
    // Rejected writes push nothing; the successful restore pushes once.
    const { triggerCoupleEvent } = await import("@/lib/pusher-server");
    expect(triggerCoupleEvent).toHaveBeenCalledTimes(1);
    expect(triggerCoupleEvent).toHaveBeenCalledWith(COUPLE, "GAMES_LEADERBOARD");
  });
});
