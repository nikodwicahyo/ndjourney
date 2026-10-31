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
    let fresh = await prisma.gameQuestion.findMany({
      where: excluded.length > 0 ? { ...where, id: { notIn: excluded } } : where,
      take: count * 3,
      select: questionSelect,
    });

    // Server-side cycle: when every question has been answered/excluded,
    // fall back to the full bank instead of returning an empty batch.
    if (fresh.length === 0 && excluded.length > 0) {
      fresh = await prisma.gameQuestion.findMany({
        where,
        take: count * 3,
        select: questionSelect,
      });
    }

    const picked = shuffleArray(fresh).slice(0, count);

    // Do NOT recycle answered questions here: returning an empty batch is the
    // signal the client uses to reset the no-repeat cycle. Recycling caused
    // "play again" to serve the same questions forever.
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

/** Types that record completed quiz rounds in `GameRound`. */
export const QA_GAME_TYPES = ["WOULD_YOU_RATHER", "TRIVIA"] as const;
/** Types that record one row per finished run in `GameArcadeScore`. */
export const ARCADE_GAME_TYPES = ["SLIDING_PUZZLE", "MEMORY_BLOCK_BLAST"] as const;

const QA_POINTS_PER_CORRECT = 1000;

export type GameBreakdownEntry = {
  type: string;
  plays: number;
  score: number;
  correct?: number;
  answered?: number;
  accuracy?: number;
};

export type GameLeaderboardEntry = {
  user: ReturnType<typeof toPublicUser>;
  playerName: string | null;
  /** Completed rounds (quiz) or finished runs (arcade) — never answer count. */
  totalPlayed: number;
  /** Ranking score: arcade points + quiz points (correct × 1000). */
  totalScore: number;
  totalCorrect?: number;
  totalAnswered?: number;
  accuracy?: number;
  bestScore?: number;
  avgScore?: number;
  /** Per-game split, only populated on the merged "Semua" tab. */
  games?: GameBreakdownEntry[];
};

type QaAggRow = {
  userId: string | null;
  playerName: string | null;
  gameType: string;
  plays: bigint;
  correct: bigint;
  answered: bigint;
};

type ArcadeAggRow = {
  userId: string | null;
  playerName: string | null;
  gameType: string;
  plays: bigint;
  totalScore: bigint;
  bestScore: bigint;
  avgScore: bigint;
};

function qaAggregates(type: (typeof QA_GAME_TYPES)[number] | null) {
  if (type) {
    return prisma.$queryRaw<QaAggRow[]>`
      SELECT
        "userId",
        "playerName",
        ${type}::text AS "gameType",
        COUNT(*)::bigint AS "plays",
        COALESCE(SUM("correct"), 0)::bigint AS "correct",
        COALESCE(SUM("totalQuestions"), 0)::bigint AS "answered"
      FROM "GameRound"
      WHERE "gameType" = ${type}::"GameType"
      GROUP BY COALESCE("userId", '__guest__:' || "playerName"), "userId", "playerName"
      ORDER BY "correct" DESC
      LIMIT 50
    `;
  }
  return prisma.$queryRaw<QaAggRow[]>`
    SELECT
      "userId",
      "playerName",
      "gameType"::text AS "gameType",
      COUNT(*)::bigint AS "plays",
      COALESCE(SUM("correct"), 0)::bigint AS "correct",
      COALESCE(SUM("totalQuestions"), 0)::bigint AS "answered"
    FROM "GameRound"
    GROUP BY COALESCE("userId", '__guest__:' || "playerName"), "userId", "playerName", "gameType"
  `;
}

function arcadeAggregates(type: (typeof ARCADE_GAME_TYPES)[number] | null) {
  if (type) {
    return prisma.$queryRaw<ArcadeAggRow[]>`
      SELECT
        "userId",
        "playerName",
        ${type}::text AS "gameType",
        COUNT(*)::bigint AS "plays",
        COALESCE(SUM("score"), 0)::bigint AS "totalScore",
        COALESCE(MAX("score"), 0)::bigint AS "bestScore",
        COALESCE(AVG("score"), 0)::bigint AS "avgScore"
      FROM "GameArcadeScore"
      WHERE "gameType" = ${type}::"GameType"
      GROUP BY COALESCE("userId", '__guest__:' || "playerName"), "userId", "playerName"
      ORDER BY "totalScore" DESC
      LIMIT 50
    `;
  }
  return prisma.$queryRaw<ArcadeAggRow[]>`
    SELECT
      "userId",
      "playerName",
      "gameType"::text AS "gameType",
      COUNT(*)::bigint AS "plays",
      COALESCE(SUM("score"), 0)::bigint AS "totalScore",
      COALESCE(MAX("score"), 0)::bigint AS "bestScore",
      COALESCE(AVG("score"), 0)::bigint AS "avgScore"
    FROM "GameArcadeScore"
    GROUP BY COALESCE("userId", '__guest__:' || "playerName"), "userId", "playerName", "gameType"
  `;
}

function accuracyOf(correct: number, answered: number): number {
  return answered > 0 ? Math.round((correct / answered) * 100) : 0;
}

/**
 * Single source for every leaderboard tab (per game AND the merged "Semua"
 * tab) — GET /api/games/leaderboard and the dashboard hydration both call it.
 *
 * Plays come from the round ledgers (`GameRound` / `GameArcadeScore`), never
 * from `GameScore` (one row per answered question, `unique(userId, questionId)`).
 * Merged ranking keeps the historical composite: correct × 1000 + arcade score.
 */
export async function getGameLeaderboard(type: string | null): Promise<GameLeaderboardEntry[]> {
  const isArcadeType = type != null && (ARCADE_GAME_TYPES as readonly string[]).includes(type);
  const isQaType = type != null && (QA_GAME_TYPES as readonly string[]).includes(type);
  if (type != null && !isArcadeType && !isQaType) return [];

  const [qaRows, arcadeRows] = await Promise.all([
    type == null || isQaType ? qaAggregates(isQaType ? (type as (typeof QA_GAME_TYPES)[number]) : null) : Promise.resolve([]),
    type == null || isArcadeType ? arcadeAggregates(isArcadeType ? (type as (typeof ARCADE_GAME_TYPES)[number]) : null) : Promise.resolve([]),
  ]);

  if (type != null && qaRows.length === 0 && arcadeRows.length === 0) return [];

  const userIds = [...new Set([...qaRows, ...arcadeRows].map((r) => r.userId).filter((id): id is string => !!id))];
  const userMap = userIds.length > 0 ? await batchLoadUsers(userIds) : new Map();

  // Per-type tabs use one ledger only.
  if (isQaType) {
    return qaRows.map((row) => {
      const correct = Number(row.correct);
      const answered = Number(row.answered);
      return {
        user: row.userId ? toPublicUser(userMap.get(row.userId)) : null,
        playerName: row.userId ? null : (row.playerName ?? null),
        totalPlayed: Number(row.plays),
        totalScore: correct * QA_POINTS_PER_CORRECT,
        totalCorrect: correct,
        totalAnswered: answered,
        accuracy: accuracyOf(correct, answered),
      };
    });
  }

  if (isArcadeType) {
    return arcadeRows.map((row) => ({
      user: row.userId ? toPublicUser(userMap.get(row.userId)) : null,
      playerName: row.userId ? null : (row.playerName ?? null),
      totalPlayed: Number(row.plays),
      totalScore: Number(row.totalScore),
      bestScore: Number(row.bestScore),
      avgScore: Number(row.avgScore),
    }));
  }

  // Merged "Semua": every game contributes its own plays and score.
  // ponytail: per-user aggregates are merged in JS (at most one row per game
  // per user). Move the composite into a single SQL UNION + ORDER BY ... LIMIT
  // if the user base grows beyond a few hundred.
  const merged = new Map<string, GameLeaderboardEntry & { _qaCorrect: number; _qaAnswered: number; _arcadeScore: number }>();

  const get = (playerKey: string, userId: string | null, playerName: string | null) => {
    let entry = merged.get(playerKey);
    if (!entry) {
      entry = {
        user: userId ? toPublicUser(userMap.get(userId!)) : null,
        playerName: userId ? null : (playerName ?? null),
        totalPlayed: 0,
        totalScore: 0,
        bestScore: 0,
        totalCorrect: 0,
        totalAnswered: 0,
        games: [],
        _qaCorrect: 0,
        _qaAnswered: 0,
        _arcadeScore: 0,
      };
      merged.set(playerKey, entry);
    }
    return entry;
  };

  for (const row of qaRows) {
    const entry = get(row.userId ? row.userId : `__guest__:${row.playerName}`, row.userId, row.playerName);
    const plays = Number(row.plays);
    const correct = Number(row.correct);
    const answered = Number(row.answered);
    entry.totalPlayed += plays;
    entry._qaCorrect += correct;
    entry._qaAnswered += answered;
    entry.games!.push({
      type: row.gameType,
      plays,
      score: correct * QA_POINTS_PER_CORRECT,
      correct,
      answered,
      accuracy: accuracyOf(correct, answered),
    });
  }

  for (const row of arcadeRows) {
    const entry = get(row.userId ? row.userId : `__guest__:${row.playerName}`, row.userId, row.playerName);
    const plays = Number(row.plays);
    const totalScore = Number(row.totalScore);
    entry.totalPlayed += plays;
    entry._arcadeScore += totalScore;
    entry.bestScore = Math.max(entry.bestScore ?? 0, Number(row.bestScore));
    entry.games!.push({ type: row.gameType, plays, score: totalScore });
  }

  return [...merged.values()]
    .map(({ _qaCorrect, _qaAnswered, _arcadeScore, ...entry }) => ({
      ...entry,
      totalCorrect: _qaCorrect,
      totalAnswered: _qaAnswered,
      accuracy: accuracyOf(_qaCorrect, _qaAnswered),
      totalScore: _qaCorrect * QA_POINTS_PER_CORRECT + _arcadeScore,
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 50);
}

/**
 * Arcade-only board, shared by the legacy /api/games/arcade-leaderboard route
 * (GameManager stats panel) so both endpoints aggregate identically.
 */
export async function getArcadeLeaderboard(
  type: (typeof ARCADE_GAME_TYPES)[number],
): Promise<GameLeaderboardEntry[]> {
  return getGameLeaderboard(type);
}


/**
 * Cache-hit responses arrive JSON-deserialized while fresh Prisma rows carry
 * Date objects. Normalizing to plain JSON keeps the route payload and the
 * RSC-hydrated payload byte-identical for consumers regardless of cache state.
 */
function toJsonSafe<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
