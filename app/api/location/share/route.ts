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

    // Flag change and row deletion are one unit: a failed delete rolls back
    // the opt-out instead of leaving a stale location behind the flag.
    await prisma.$transaction(async (tx) => {
      await tx.locationShare.upsert({
        where: { userId },
        create: { userId, coupleId, isSharing },
        update: { isSharing },
      });

      if (!isSharing) {
        await tx.userLocation.deleteMany({ where: { userId } });
      }
    });

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
