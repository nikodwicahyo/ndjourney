import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateShareSchema } from "@/lib/validations/location";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { getUserCoupleId } from "@/lib/couple";
import { emitActivity } from "@/lib/activity";
import { triggerCoupleEvent } from "@/lib/pusher-server";
import { lockLocationWrite } from "@/lib/location-write";

export const dynamic = "force-dynamic";

// Own status only — the global presence tracker reads this on every page to
// decide whether the background GPS watcher should run. No couple id needed:
// a solo user simply has sharing off.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const share = await prisma.locationShare.findUnique({
      where: { userId: session.user.id },
      select: { isSharing: true },
    });

    return NextResponse.json(
      { data: { isSharing: share?.isSharing ?? false } },
      { headers: { "Cache-Control": "private, no-cache" } },
    );
  } catch (error) {
    console.error("Error reading share setting:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.write);
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

    const userId = rateCheck.session.user.id;
    const coupleId = await getUserCoupleId(userId);
    if (!coupleId) {
      return NextResponse.json(
        { error: "Pasangan belum ditemukan" },
        { status: 404 },
      );
    }

    const body = await request.json().catch(() => null);
    if (body == null) return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    const parsed = updateShareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Data tidak valid" },
        { status: 400 },
      );
    }

    const isSharing = parsed.data.isSharing;
    const previous = await prisma.locationShare.findUnique({
      where: { userId },
      select: { isSharing: true },
    });

    // Flag change and row deletion are one unit: a failed delete rolls back
    // the opt-out instead of leaving a stale location behind the flag.
    await prisma.$transaction(async (tx) => {
      // Same per-user lock as the location writes: an opt-out cannot interleave
      // between a POST's share re-check and its upsert and resurrect a row.
      await lockLocationWrite(tx, userId);
      await tx.locationShare.upsert({
        where: { userId },
        create: { userId, coupleId, isSharing },
        update: { isSharing },
      });

      if (!isSharing) {
        await tx.userLocation.deleteMany({ where: { userId } });
      }
    });

    // Only the off→on transition notifies: share-off and plain updates must
    // not create feed rows (live pings are the ephemeral /api/location path).
    if (isSharing && !previous?.isSharing) {
      await emitActivity(coupleId, userId, {
        type: "location",
        action: "updated",
        title: "Partner online",
        body: `${rateCheck.session.user.name || "Pasangan"} mulai berbagi lokasi`,
        href: "/location",
        level: "both",
      });
    } else if (!isSharing && previous?.isSharing) {
      // Turning off still has to refresh the partner's live map (no feed row).
      // Await: a fire-and-forget trigger can be killed with the invocation.
      await triggerCoupleEvent(coupleId, "LOCATION");
    }

    return NextResponse.json({ data: { isSharing } }, { status: 200 });
  } catch (error) {
    console.error("Error updating share setting:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
