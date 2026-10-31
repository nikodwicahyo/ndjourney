import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached, cacheKey } from "@/lib/redis";
import { getGameLeaderboard } from "@/lib/queries/games";
import { withAnonymousRateLimit } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { z } from "zod";

const CACHE_TTL = 300;

// guard enum before raw cast — invalid ?type= was 500
const gameTypeParam = z.enum(["WOULD_YOU_RATHER", "TRIVIA", "SPIN_THE_WHEEL", "TRUTH_OR_DARE", "SLIDING_PUZZLE", "MEMORY_BLOCK_BLAST"]);

export async function GET(request: NextRequest) {
  try {
    // MR-07: full-table GROUP BY per cache miss — throttle anon scraping
    // (300/hr is far above human polling; cache hits are unaffected).
    const session = await auth();
    if (!session?.user) {
      const rl = await withAnonymousRateLimit(request, { maxRequests: 300, windowSeconds: 3600, keyPrefix: "games:leaderboard" });
      if (!rl.allowed) return rl.response;
    }
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    if (type && !gameTypeParam.safeParse(type).success) {
      return NextResponse.json({ error: "Tipe game tidak valid" }, { status: 400 });
    }
    const cacheSegment = type || "all";

    const cacheK = cacheKey("games", "leaderboard", cacheSegment);
    const cached = await getCached<unknown>(cacheK);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "private, no-cache" },
      });
    }

    const leaderboard = await getGameLeaderboard(type);

    if (leaderboard.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const response = { data: leaderboard };

    await setCached(cacheK, response, CACHE_TTL);

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
