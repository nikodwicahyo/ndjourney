import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { locationStatusSchema } from "@/lib/validations/location";
import { triggerCoupleEvent } from "@/lib/pusher-server";
import { checkActiveShare, parseJsonBody, shareError } from "@/lib/location/server";

export const dynamic = "force-dynamic";

/**
 * Coordinate-free heartbeat. Keeps `lastSeenAt` fresh while the app is alive
 * but GPS has no fix, so the partner sees "GPS belum dapat" instead of a lie.
 */
export async function POST(request: Request) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.locationStatus);
    if (!rateCheck.allowed) return rateCheck.response;

    const userId = rateCheck.session.user.id;
    const parsed = locationStatusSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Status tidak valid" },
        { status: 400 },
      );
    }

    const { trackingState } = parsed.data;
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const shareCheck = await checkActiveShare(tx, userId, now);
      if (!shareCheck.ok) return { ok: false as const, code: shareCheck.code };

      const changed = shareCheck.trackingState !== trackingState;
      await tx.locationShare.update({
        where: { userId },
        data: { lastSeenAt: now, trackingState },
      });
      return { ok: true as const, coupleId: shareCheck.coupleId, changed };
    });

    if (!result.ok) {
      const error = shareError(result.code);
      return NextResponse.json(error.body, { status: error.status });
    }

    // A 30 s heartbeat must not spam the partner; only a real state change does.
    if (result.changed) triggerCoupleEvent(result.coupleId, "LOCATION");

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    console.error("Error updating location status:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
