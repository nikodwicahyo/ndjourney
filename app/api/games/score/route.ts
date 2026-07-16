import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { submitScoreSchema } from "@/lib/validations/game";
import { withRateLimit, withAnonymousRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { invalidateCache } from "@/lib/redis";
import { auth } from "@/lib/auth";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = submitScoreSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validasi gagal" },
        { status: 400 },
      );
    }

    const session = await auth();
    const isAuthed = !!session?.user?.id;

    if (!isAuthed && !parsed.data.playerName) {
      return NextResponse.json(
        { error: "Nama pemain diperlukan untuk pengguna publik" },
        { status: 400 },
      );
    }

    if (isAuthed) {
      const rateCheck = await withRateLimit(request, rateLimitConfigs.score);
      if (!rateCheck.allowed) return rateCheck.response;
    } else {
      const rateCheck = await withAnonymousRateLimit(request, rateLimitConfigs.score);
      if (!rateCheck.allowed) return rateCheck.response;
    }

    const existingScore = isAuthed
      ? await prisma.gameScore.findFirst({
          where: { userId: session!.user.id, questionId: parsed.data.questionId },
          select: { id: true },
        })
      : await prisma.gameScore.findFirst({
          where: { playerName: parsed.data.playerName!, questionId: parsed.data.questionId },
          select: { id: true },
        });

    if (existingScore) {
      return NextResponse.json(
        { error: "Kamu sudah menjawab pertanyaan ini" },
        { status: 409 },
      );
    }

    const score = await prisma.gameScore.create({
      data: {
        userId: isAuthed ? session!.user.id : undefined,
        playerName: isAuthed ? undefined : parsed.data.playerName!,
        questionId: parsed.data.questionId,
        isCorrect: parsed.data.isCorrect,
      },
      select: {
        id: true,
        userId: true,
        playerName: true,
        questionId: true,
        isCorrect: true,
        playedAt: true,
      },
    });

    await invalidateCache("games:*");

    if (isAuthed) {
      const coupleId = await getUserCoupleId(session!.user.id);
      if (coupleId) {
        await triggerCoupleEvent(coupleId, 'GAMES_LEADERBOARD');
      }
    }

    return NextResponse.json({ data: score }, { status: 201 });
  } catch (error) {
    console.error("Error recording score:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
