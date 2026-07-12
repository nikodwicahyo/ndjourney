import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getCached, setCached, cacheKey } from "@/lib/redis";
import { batchLoadUsers } from "@/lib/batch";

const CACHE_TTL = 300;

export async function GET() {
  try {
    const cacheK = cacheKey("games", "leaderboard");
    const cached = await getCached<unknown>(cacheK);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      });
    }

    const rows = await prisma.$queryRaw<
      Array<{ userId: string; totalPlayed: bigint; totalCorrect: bigint }>
    >`
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

    if (rows.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const authedUserIds = rows.map(r => r.userId);
    const userMap = authedUserIds.length > 0 ? await batchLoadUsers(authedUserIds) : new Map();

    const leaderboard = rows.map((row) => {
      const totalPlayed = Number(row.totalPlayed);
      const totalCorrect = Number(row.totalCorrect);
      return {
        user: userMap.get(row.userId) ?? null,
        playerName: null,
        totalPlayed,
        totalCorrect,
        accuracy:
          totalPlayed > 0
            ? Math.round((totalCorrect / totalPlayed) * 100)
            : 0,
      };
    });

    const response = { data: leaderboard };

    await setCached(cacheK, response, CACHE_TTL);

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
