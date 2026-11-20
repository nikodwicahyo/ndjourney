import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { batchLocationSchema } from "@/lib/validations/location";
import { triggerCoupleEvent } from "@/lib/pusher-server";
import { checkActiveShare, isPlausibleFix, parseJsonBody, shareError } from "@/lib/location/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.locationBatch);
    if (!rateCheck.allowed) return rateCheck.response;

    const userId = rateCheck.session.user.id;
    const parsed = batchLocationSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Batch lokasi tidak valid" },
        { status: 400 },
      );
    }

    const fixes = parsed.data.fixes;
    const now = new Date();
    const fixTime = (fix: (typeof fixes)[number]) =>
      fix.recordedAt ? Date.parse(fix.recordedAt) : now.getTime();

    const result = await prisma.$transaction(async (tx) => {
      const shareCheck = await checkActiveShare(tx, userId, now);
      if (!shareCheck.ok) return { ok: false as const, code: shareCheck.code };

      const existing = await tx.userLocation.findUnique({
        where: { userId },
        select: { updatedAt: true, latitude: true, longitude: true },
      });

      const historyRows = [];
      let rejected = 0;
      for (const fix of fixes) {
        if (existing && !isPlausibleFix(existing, fix, new Date(fixTime(fix)))) {
          rejected++;
          continue;
        }
        historyRows.push({
          userId,
          coupleId: shareCheck.coupleId,
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracy: fix.accuracy ?? null,
          heading: fix.heading ?? null,
          speed: fix.speed ?? null,
          altitude: fix.altitude ?? null,
          deviceType: fix.deviceType,
          createdAt: new Date(fixTime(fix)),
          clientId: fix.clientId ?? null,
          recordedAt: fix.clientId ? new Date(fixTime(fix)) : null,
        });
      }

      // skipDuplicates makes a retried batch a no-op instead of a 500.
      const inserted = historyRows.length
        ? await tx.userLocationHistory.createMany({ data: historyRows, skipDuplicates: true })
        : { count: 0 };

      // The newest sample wins the live pin, not the last one in the array.
      const newest = fixes.reduce((a, b) => (fixTime(b) >= fixTime(a) ? b : a));
      const point = {
        latitude: newest.latitude,
        longitude: newest.longitude,
        accuracy: newest.accuracy ?? null,
        heading: newest.heading ?? null,
        speed: newest.speed ?? null,
        altitude: newest.altitude ?? null,
        deviceType: newest.deviceType,
      };
      await tx.userLocation.upsert({
        where: { userId },
        create: { userId, coupleId: shareCheck.coupleId, ...point },
        update: point,
      });
      await tx.locationShare.update({
        where: { userId },
        data: { lastSeenAt: now, trackingState: newest.trackingState ?? "foreground" },
      });

      return {
        ok: true as const,
        coupleId: shareCheck.coupleId,
        accepted: inserted.count,
        duplicates: historyRows.length - inserted.count,
        rejected,
      };
    });

    if (!result.ok) {
      const error = shareError(result.code);
      return NextResponse.json(error.body, { status: error.status });
    }

    // One event for the whole batch — not one per fix.
    triggerCoupleEvent(result.coupleId, "LOCATION");

    return NextResponse.json({
      data: {
        accepted: result.accepted,
        duplicates: result.duplicates,
        rejected: result.rejected,
      },
    });
  } catch (error) {
    console.error("Error flushing location batch:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
