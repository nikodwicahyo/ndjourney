import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { safeTokenEqual } from "@/lib/api-body";
import { triggerCoupleEvent } from "@/lib/pusher-server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** The 2000-point cap used to run on every GPS write. One daily pass is enough. */
const HISTORY_LIMIT = 2000;

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("CRON_SECRET is not configured");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token || !safeTokenEqual(token, cronSecret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    // Read first so the partner can be told to refresh after the lazy opt-out.
    const expired = await prisma.locationShare.findMany({
      where: { isSharing: true, expiresAt: { lt: now } },
      select: { userId: true, coupleId: true },
    });
    const expiredIds = expired.map((s) => s.userId);
    if (expiredIds.length > 0) {
      await prisma.locationShare.updateMany({
        where: { userId: { in: expiredIds } },
        data: { isSharing: false, expiresAt: null, trackingState: "stopped" },
      });
      await prisma.userLocation.deleteMany({
        where: { userId: { in: expiredIds } },
      });
      for (const share of expired) triggerCoupleEvent(share.coupleId, "LOCATION");
    }

    // One set-based statement for every user (ROW_NUMBER per partition),
    // not one findMany/deleteMany pair per user.
    const trimmed = await prisma.$executeRaw`
      DELETE FROM "UserLocationHistory"
      WHERE "id" IN (
        SELECT "id" FROM (
          SELECT "id", ROW_NUMBER() OVER (
            PARTITION BY "userId" ORDER BY "createdAt" DESC, "id" DESC
          ) AS rn
          FROM "UserLocationHistory"
        ) ranked
        WHERE ranked.rn > ${HISTORY_LIMIT}
      )
    `;

    return NextResponse.json({
      data: { expiredShares: expired.length, trimmedHistory: trimmed },
    });
  } catch (error) {
    console.error("Error in location maintenance:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
