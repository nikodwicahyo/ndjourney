import { prisma } from "@/lib/prisma";
import { batchLoadUsers, toPublicUser } from "@/lib/batch";
import { getCached, setCached, cacheKey } from "@/lib/redis";

const QUESTION_CACHE_TTL = 600;

export type GameQuestionRow = {
  id: string;
  type: string;
  question: string;
  optionA: string | null;
  optionB: string | null;
  answer?: string | null;
  category: string | null;
  createdAt: string;
};

const baseQuestionSelect = {
  id: true,
  type: true,
  question: true,
  optionA: true,
  optionB: true,
  category: true,
  createdAt: true,
} as const;

const fullQuestionSelect = {
  ...baseQuestionSelect,
  answer: true,
} as const;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Question bank listing.
 * Single source for GET /api/games/questions and the dashboard games page's
 * server-side hydration — both must stay in lockstep.
 *
 * `random` picks are per-player (server GameScore + caller-provided excludes)
 * and intentionally uncached; only the deterministic listing uses Redis.
 *
 * The answer key is only selected when `includeAnswer` is set (dashboard CRUD).
 * Public payloads must never carry it — the server grades submissions.
 */
export async function listGameQuestions(opts: {
  type?: string | null;
  category?: string | null;
  sort?: string;
  limit: number;
  includeAnswer?: boolean;
  random?: { count: number; excludeIds: string[]; answeredBy?: string } | null;
}): Promise<{ data: GameQuestionRow[]; total?: number }> {
  const { type, category, sort = "desc", limit, includeAnswer = false, random } = opts;
  const questionSelect = includeAnswer ? fullQuestionSelect : baseQuestionSelect;

  const where: Record<string, unknown> = { isArchived: false };
  if (type) where.type = type;
  if (category) where.category = category;

  if (random) {
    // MR-12: clamp + DB-side prefilter — the old path loaded the ENTIRE
    // bank into memory and shuffled in JS (O(table) per game start).
    const { count, excludeIds, answeredBy } = random;

    const answeredIds = new Set<string>(excludeIds);
    if (answeredBy) {
      const scores = await prisma.gameScore.findMany({
        where: { userId: answeredBy },
        select: { questionId: true },
      });
      for (const s of scores) answeredIds.add(s.questionId);
    }

    const excluded = [...answeredIds];
    // Over-fetch 3x so the JS shuffle still has entropy; answered rows are
    // only fetched as a fallback fill below.
    const fresh = await prisma.gameQuestion.findMany({
      where: excluded.length > 0 ? { ...where, id: { notIn: excluded } } : where,
      take: count * 3,
      select: questionSelect,
    });

    const picked = shuffleArray(fresh).slice(0, count);

    if (picked.length < count && excluded.length > 0) {
      // Bank exhausted for this player — recycle answered questions.
      const recycled = await prisma.gameQuestion.findMany({
        where: { ...where, id: { in: excluded } },
        take: count - picked.length,
        select: questionSelect,
      });
      picked.push(...shuffleArray(recycled));
    }

    const total = await prisma.gameQuestion.count({ where });
    return { data: toJsonSafe<GameQuestionRow[]>(picked), total };
  }

  const cacheK = cacheKey("games", "questions", type ?? "all", category ?? "all", sort, "0", String(limit), includeAnswer ? "full" : "public");
  const cached = await getCached<{ data: GameQuestionRow[] }>(cacheK);
  if (cached) return cached;

  const questions = await prisma.gameQuestion.findMany({
    where,
    take: limit,
    orderBy: { createdAt: sort === "asc" ? "asc" : "desc" },
    select: questionSelect,
  });

  const response = toJsonSafe<{ data: GameQuestionRow[] }>({ data: questions });
  await setCached(cacheK, response, QUESTION_CACHE_TTL);
  return response;
}

export type QaLeaderboardEntry = {
  user: ReturnType<typeof toPublicUser>;
  playerName: null;
  totalPlayed: number;
  totalCorrect: number;
  accuracy: number;
};

type RawRow = { userId: string; totalPlayed: bigint; totalCorrect: bigint };

/**
 * Q&A leaderboard (Would You Rather / Love Quiz / …).
 * Single source for GET /api/games/leaderboard and the dashboard games page's
 * server-side hydration. Public shape — no emails.
 */
export async function getQaLeaderboard(type: string | null): Promise<QaLeaderboardEntry[]> {
  let rows: RawRow[];

  if (type) {
    rows = await prisma.$queryRaw<RawRow[]>`
      SELECT
        gs."userId",
        COUNT(*)::bigint AS "totalPlayed",
        COALESCE(SUM(CASE WHEN gs."isCorrect" THEN 1 ELSE 0 END), 0)::bigint AS "totalCorrect"
      FROM "GameScore" gs
      JOIN "GameQuestion" q ON q.id = gs."questionId"
      WHERE gs."userId" IS NOT NULL AND q."type" = ${type}::"GameType"
      GROUP BY gs."userId"
      ORDER BY "totalCorrect" DESC
      LIMIT 50
    `;
  } else {
    rows = await prisma.$queryRaw<RawRow[]>`
      SELECT
        "userId",
        COUNT(*)::bigint AS "totalPlayed",
        COALESCE(SUM(CASE WHEN "isCorrect" THEN 1 ELSE 0 END), 0)::bigint AS "totalCorrect"
      FROM "GameScore"
      WHERE "userId" IS NOT NULL
      GROUP BY "userId"
      ORDER BY "totalCorrect" DESC
      LIMIT 50
    `;
  }

  if (rows.length === 0) return [];

  const authedUserIds = rows.map((r) => r.userId);
  const userMap = authedUserIds.length > 0 ? await batchLoadUsers(authedUserIds) : new Map();

  return rows.map((row) => {
    const totalPlayed = Number(row.totalPlayed);
    const totalCorrect = Number(row.totalCorrect);
    return {
      // public endpoint — no emails in response.
      user: toPublicUser(userMap.get(row.userId)),
      playerName: null,
      totalPlayed,
      totalCorrect,
      accuracy:
        totalPlayed > 0
          ? Math.round((totalCorrect / totalPlayed) * 100)
          : 0,
    };
  });
}

/**
 * Cache-hit responses arrive JSON-deserialized while fresh Prisma rows carry
 * Date objects. Normalizing to plain JSON keeps the route payload and the
 * RSC-hydrated payload byte-identical for consumers regardless of cache state.
 */
function toJsonSafe<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
