import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getCached, setCached, cacheKey } from "@/lib/redis";
import { getNextBirthday, getAge } from "@/lib/date";
import { getCloudinaryUsage } from "@/lib/cloudinary";

const CACHE_TTL = 180;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // couple-scoped cache (was per-user: 2 entries, half hit-rate for shared data).
    const coupleMember = await prisma.coupleMember.findUnique({
      where: { userId: session.user.id },
      select: { coupleId: true },
    });

    const coupleId = coupleMember?.coupleId;

    const cacheK = cacheKey("dashboard", "stats", coupleId ?? session.user.id);
    const unreadK = cacheKey("dashboard", "unread", session.user.id);
    const [cached, cachedUnread] = await Promise.all([
      getCached<Record<string, number>>(cacheK),
      getCached<number>(unreadK),
    ]);
    if (cached) {
      // unread count is per-user — cached separately (never in the shared couple entry).
      let unreadLetterCount = cachedUnread;
      if (unreadLetterCount == null) {
        unreadLetterCount = await prisma.letter.count({
          where: { recipientId: session.user.id, isOpened: false },
        });
        await setCached(unreadK, unreadLetterCount, 30);
      }
      return NextResponse.json({
        data: {
          storageUsed: 0,
          storageLimit: 0,
          ...cached,
          unreadLetterCount,
        },
      }, {
        headers: { "Cache-Control": "private, no-cache" },
      });
    }

    const zeroStats = {
      photoCount: 0,
      videoCount: 0,
      letterCount: 0,
      unreadLetterCount: 0,
      milestoneCount: 0,
      daysSinceAnniversary: 0,
      daysUntilBirthday1: 0,
      daysUntilBirthday2: 0,
      birthday1Age: null,
      birthday2Age: null,
      storageUsed: 0,
      storageLimit: 0,
    };

    if (!coupleId) {
      return NextResponse.json({ data: zeroStats });
    }

    // P-01: predicates on indexed "coupleId" (was uploadedById/authorId IN-subqueries
    // forcing seq scans), and the Cloudinary fan-out runs in parallel, not serial.
    const rowsPromise = prisma.$queryRaw<Array<{
      photoCount: bigint;
      videoCount: bigint;
      letterCount: bigint;
      milestoneCount: bigint;
      anniversaryDate: Date | null;
      birthDate1: Date | null;
      birthDate2: Date | null;
    }>>`
      SELECT
        (SELECT COUNT(*)::int FROM "Photo" WHERE "isVideo" = false AND "isMilestoneOnly" = false AND ("coupleId" = ${coupleId} OR "coupleId" IS NULL)) AS "photoCount",
        (SELECT COUNT(*)::int FROM "Photo" WHERE "isVideo" = true AND "isMilestoneOnly" = false AND ("coupleId" = ${coupleId} OR "coupleId" IS NULL)) AS "videoCount",
        (SELECT COUNT(*)::int FROM "Letter" WHERE ("coupleId" = ${coupleId} OR "coupleId" IS NULL)) AS "letterCount",
        (SELECT COUNT(*)::int FROM "Milestone" WHERE ("coupleId" = ${coupleId} OR "coupleId" IS NULL)) AS "milestoneCount",
        (SELECT "anniversaryDate" FROM "CoupleConfig" LIMIT 1) AS "anniversaryDate",
        (SELECT "birthDate1" FROM "CoupleConfig" LIMIT 1) AS "birthDate1",
        (SELECT "birthDate2" FROM "CoupleConfig" LIMIT 1) AS "birthDate2"
    `;

    const cloudinaryPromise = getCloudinaryUsage();

    // per-user unread via indexed COUNT (never shared across members).
    const unreadPromise = prisma.letter.count({
      where: { recipientId: session.user.id, isOpened: false },
    });

    const [rows, cloudinaryUsage, unreadLetterCount] = await Promise.all([
      rowsPromise,
      cloudinaryPromise,
      unreadPromise,
    ]);
    await setCached(unreadK, unreadLetterCount, 30);

    const row = rows[0];
    const today = new Date();

    const daysSinceAnniversary = row?.anniversaryDate
      ? Math.floor(
          (today.getTime() - new Date(row.anniversaryDate).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    function daysUntilNextBirthday(birthDate: Date | null): number {
      if (!birthDate) return 0;
      const next = getNextBirthday(birthDate);
      if (!next) return 0;
      return Math.floor((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    const stats = {
      photoCount: Number(row?.photoCount ?? 0),
      videoCount: Number(row?.videoCount ?? 0),
      letterCount: Number(row?.letterCount ?? 0),
      milestoneCount: Number(row?.milestoneCount ?? 0),
      daysSinceAnniversary,
      unreadLetterCount,
      daysUntilBirthday1: daysUntilNextBirthday(row?.birthDate1 ?? null),
      daysUntilBirthday2: daysUntilNextBirthday(row?.birthDate2 ?? null),
      birthday1Age: getAge(row?.birthDate1 ?? null),
      birthday2Age: getAge(row?.birthDate2 ?? null),
      storageUsed: cloudinaryUsage.storageUsed,
      storageLimit: cloudinaryUsage.storageLimit,
    };

    // shared couple entry holds couple-level fields only.
    const { unreadLetterCount: _mine, ...sharedStats } = stats;
    await setCached(cacheK, sharedStats, CACHE_TTL);

    return NextResponse.json({ data: stats }, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
