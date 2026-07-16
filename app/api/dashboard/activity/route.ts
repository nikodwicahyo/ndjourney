import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getCached, setCached, cacheKey } from "@/lib/redis";
import { batchLoadUsers } from "@/lib/batch";

const CACHE_TTL = 120;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cacheK = cacheKey("dashboard", "activity", session.user.id);
    const cached = await getCached<unknown>(cacheK);
    if (cached) {
      return NextResponse.json({ data: cached }, {
        headers: { "Cache-Control": "private, no-cache" },
      });
    }

    const rows = await prisma.$queryRaw<Array<{
      id: string;
      type: string;
      description: string;
      createdAt: Date;
      userId: string;
    }>>`
      (
        SELECT id, 'photo' AS type, COALESCE(caption, 'Menambahkan foto baru') AS description, "createdAt", "uploadedById" AS "userId"
        FROM "Photo"
        ORDER BY "createdAt" DESC
        LIMIT 5
      )
      UNION ALL
      (
        SELECT id, 'letter' AS type, 'Menulis surat: ' || title AS description, "createdAt", "authorId" AS "userId"
        FROM "Letter"
        ORDER BY "createdAt" DESC
        LIMIT 5
      )
      UNION ALL
      (
        SELECT id, 'milestone' AS type, 'Menambahkan milestone: ' || title AS description, "createdAt", "createdById" AS "userId"
        FROM "Milestone"
        ORDER BY "createdAt" DESC
        LIMIT 5
      )
      ORDER BY "createdAt" DESC
      LIMIT 10
    `;

    if (rows.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const userIds = rows.map((r) => r.userId);
    const userMap = await batchLoadUsers(userIds);

    const data = rows.map((row) => ({
      id: row.id,
      type: row.type as "photo" | "letter" | "milestone",
      description: row.description,
      createdAt: row.createdAt,
      user: userMap.get(row.userId) ?? { id: "", name: null, image: null },
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
