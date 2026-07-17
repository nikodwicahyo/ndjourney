import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { getUserCoupleId } from "@/lib/couple";
import { pusherServer } from "@/lib/pusher-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.score);
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

    const body = await request.json().catch(() => ({}));
    const emoji = typeof body?.emoji === "string" ? body.emoji : "❤️";

    try {
      await pusherServer.trigger(`private-couple-${coupleId}`, "location-heart", {
        fromUserId: userId,
        emoji,
        at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[PUSHER_HEART_ERROR]", error);
    }

    return NextResponse.json({ data: { ok: true } }, { status: 200 });
  } catch (error) {
    console.error("Error sending heart:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
