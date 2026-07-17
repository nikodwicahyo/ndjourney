import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { updateShareSchema } from "@/lib/validations/location";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";

export const dynamic = "force-dynamic";

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

    const body = await request.json();
    const parsed = updateShareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Data tidak valid" },
        { status: 400 },
      );
    }

    const isSharing = parsed.data.isSharing;

    await prisma.locationShare.upsert({
      where: { userId },
      create: { userId, coupleId, isSharing },
      update: { isSharing },
    });

    // If the user stops sharing, clear their last known location so the
    // partner no longer sees a stale position.
    if (!isSharing) {
      await prisma.userLocation
        .delete({ where: { userId } })
        .catch(() => null);
    }

    triggerCoupleEvent(coupleId, "LOCATION");

    return NextResponse.json({ data: { isSharing } }, { status: 200 });
  } catch (error) {
    console.error("Error updating share setting:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
