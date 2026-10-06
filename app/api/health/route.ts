import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

// C-08: post-deploy smoke target (curl /api/health + version.json).
// Unauthenticated by design — /api/* bypasses proxy auth, and this route
// performs no session lookup. Reports dependency reachability, not data.
export const dynamic = "force-dynamic";

type Check = "ok" | "unreachable" | "unconfigured";

export async function GET() {
  let db: Check = "unreachable";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "ok";
  } catch {
    db = "unreachable";
  }

  let cache: Check = "unconfigured";
  if (redis) {
    try {
      await redis.ping();
      cache = "ok";
    } catch {
      cache = "unreachable";
    }
  }

  const healthy = db === "ok";
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks: { database: db, cache } },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
