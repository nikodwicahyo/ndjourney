import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getCached, setCached, cacheKey } from "@/lib/redis";
import { batchLoadUsers } from "@/lib/batch";
import { getUserCoupleId } from "@/lib/couple";

const CACHE_TTL = 120;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coupleId = await getUserCoupleId(session.user.id);
    if (!coupleId) {
      return NextResponse.json({ data: [] });
    }

    const cacheK = cacheKey("dashboard", "activity", coupleId);
    const cached = await getCached<unknown>(cacheK);
    if (cached) {
      return NextResponse.json({ data: cached }, {
        headers: { "Cache-Control": "private, no-cache" },
      });
    }

    const rows = await prisma.activityEvent.findMany({
      where: { coupleId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (rows.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const userIds = rows.map((r) => r.actorId);
    const userMap = await batchLoadUsers(userIds);

    const data = rows.map((row) => ({
      id: row.id,
      type: row.type,
      description: row.body ?? row.title,
      createdAt: row.createdAt,
      user: userMap.get(row.actorId) ?? { id: row.actorId, name: null, image: null },
    }));

    await setCached(cacheK, data, CACHE_TTL);

    return NextResponse.json({ data }, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (error) {
    console.error("Error fetching activity:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}