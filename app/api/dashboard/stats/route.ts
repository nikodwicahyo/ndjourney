import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getCached, setCached, cacheKey } from "@/lib/redis";
import { getNextBirthday, getAge } from "@/lib/date";
import { getCloudinaryUsage } from "@/lib/cloudinary";

const CACHE_TTL = 10;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cacheK = cacheKey("dashboard", "stats", session.user.id);
    const cached = await getCached<Record<string, number>>(cacheK);
    if (cached) {
      return NextResponse.json({
        data: {
          storageUsed: 0,
          storageLimit: 0,
          ...cached,
        },
      }, {
        headers: { "Cache-Control": "private, no-cache" },
      });
    }

    const coupleMember = await prisma.coupleMember.findUnique({
      where: { userId: session.user.id },
      select: { coupleId: true },
    });

    const coupleId = coupleMember?.coupleId;

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

    const rows = await prisma.$queryRaw<Array<{
      photoCount: bigint;
      videoCount: bigint;
      letterCount: bigint;
      unreadLetterCount: bigint;
      milestoneCount: bigint;
      anniversaryDate: Date | null;
      birthDate1: Date | null;
      birthDate2: Date | null;
    }>>`
      SELECT
        (SELECT COUNT(*)::int FROM "Photo" WHERE "isVideo" = false AND "isMilestoneOnly" = false AND "uploadedById" IN (SELECT "userId" FROM "CoupleMember" WHERE "coupleId" = ${coupleId})) AS "photoCount",
        (SELECT COUNT(*)::int FROM "Photo" WHERE "isVideo" = true AND "isMilestoneOnly" = false AND "uploadedById" IN (SELECT "userId" FROM "CoupleMember" WHERE "coupleId" = ${coupleId})) AS "videoCount",
        (SELECT COUNT(*)::int FROM "Letter" WHERE "authorId" IN (SELECT "userId" FROM "CoupleMember" WHERE "coupleId" = ${coupleId}) OR "recipientId" IN (SELECT "userId" FROM "CoupleMember" WHERE "coupleId" = ${coupleId})) AS "letterCount",
        (SELECT COUNT(*)::int FROM "Letter" WHERE "recipientId" = ${session.user.id} AND "isOpened" = false AND "authorId" IN (SELECT "userId" FROM "CoupleMember" WHERE "coupleId" = ${coupleId})) AS "unreadLetterCount",
        (SELECT COUNT(*)::int FROM "Milestone" WHERE "createdById" IN (SELECT "userId" FROM "CoupleMember" WHERE "coupleId" = ${coupleId})) AS "milestoneCount",
        (SELECT "anniversaryDate" FROM "CoupleConfig" LIMIT 1) AS "anniversaryDate",
        (SELECT "birthDate1" FROM "CoupleConfig" LIMIT 1) AS "birthDate1",
        (SELECT "birthDate2" FROM "CoupleConfig" LIMIT 1) AS "birthDate2"
    `;

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

    const cloudinaryUsage = await getCloudinaryUsage();

    const stats = {
      photoCount: Number(row?.photoCount ?? 0),
      videoCount: Number(row?.videoCount ?? 0),
      letterCount: Number(row?.letterCount ?? 0),
      milestoneCount: Number(row?.milestoneCount ?? 0),
      daysSinceAnniversary,
      unreadLetterCount: Number(row?.unreadLetterCount ?? 0),
      daysUntilBirthday1: daysUntilNextBirthday(row?.birthDate1 ?? null),
      daysUntilBirthday2: daysUntilNextBirthday(row?.birthDate2 ?? null),
      birthday1Age: getAge(row?.birthDate1 ?? null),
      birthday2Age: getAge(row?.birthDate2 ?? null),
      storageUsed: cloudinaryUsage.storageUsed,
      storageLimit: cloudinaryUsage.storageLimit,
    };

    await setCached(cacheK, stats, CACHE_TTL);

    return NextResponse.json({ data: stats }, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
