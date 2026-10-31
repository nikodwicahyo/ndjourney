import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached, cacheKey } from "@/lib/redis";
import { getArcadeLeaderboard, ARCADE_GAME_TYPES } from "@/lib/queries/games";
import { withAnonymousRateLimit } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";

const CACHE_TTL = 300;

export async function GET(request: NextRequest) {
  try {
    // MR-07: full-table aggregation on a cache miss — throttle anon scraping.
    const session = await auth();
    if (!session?.user) {
      const rl = await withAnonymousRateLimit(request, { maxRequests: 300, windowSeconds: 3600, keyPrefix: "games:arcade-leaderboard" });
      if (!rl.allowed) return rl.response;
    }
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (!type || !(ARCADE_GAME_TYPES as readonly string[]).includes(type)) {
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

    const leaderboard = await getArcadeLeaderboard(
      type as (typeof ARCADE_GAME_TYPES)[number],
    );

    if (leaderboard.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const response = { data: leaderboard };

    await setCached(cacheK, response, CACHE_TTL);

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (error) {
    console.error("Error fetching arcade leaderboard:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
