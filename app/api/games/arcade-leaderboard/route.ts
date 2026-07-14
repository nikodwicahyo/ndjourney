import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached, cacheKey } from "@/lib/redis";
import { batchLoadUsers } from "@/lib/batch";

const CACHE_TTL = 300;
const ARCADE_TYPES = ["SLIDING_PUZZLE", "MEMORY_BLOCK_BLAST"] as const;

type RawRow = {
  userId: string;
  totalScore: bigint;
  totalPlayed: bigint;
  bestScore: bigint;
  avgScore: bigint;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (!type || !ARCADE_TYPES.includes(type as typeof ARCADE_TYPES[number])) {
      return NextResponse.json(
        { error: "Parameter type wajib diisi (SLIDING_PUZZLE atau MEMORY_BLOCK_BLAST)" },
        { status: 400 },
      );
    }

    const cacheK = cacheKey("games", "arcade-leaderboard", type);
    const cached = await getCached<unknown>(cacheK);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "private, no-cache" },
      });
    }

    const rows = await prisma.$queryRaw<RawRow[]>`
      SELECT
        "userId",
        COALESCE(SUM(score), 0)::bigint AS "totalScore",
        COUNT(*)::bigint AS "totalPlayed",
        COALESCE(MAX(score), 0)::bigint AS "bestScore",
        COALESCE(AVG(score), 0)::bigint AS "avgScore"
      FROM "GameArcadeScore"
      WHERE "gameType" = ${type}::"GameType"
        AND "userId" IS NOT NULL
      GROUP BY "userId"
      ORDER BY "totalScore" DESC
      LIMIT 50
    `;

    if (rows.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const authedUserIds = rows.map(r => r.userId);
    const userMap = authedUserIds.length > 0 ? await batchLoadUsers(authedUserIds) : new Map();

    const leaderboard = rows.map((row) => ({
      user: userMap.get(row.userId) ?? null,
      playerName: null,
      totalScore: Number(row.totalScore),
      totalPlayed: Number(row.totalPlayed),
      bestScore: Number(row.bestScore),
      avgScore: Number(row.avgScore),
    }));

    const response = { data: leaderboard };

    await setCached(cacheK, response, CACHE_TTL);

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (error) {
    console.error("Error fetching arcade leaderboard:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
