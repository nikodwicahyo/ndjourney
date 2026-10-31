import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { submitGameRoundSchema } from "@/lib/validations/game";
import { withRateLimit, withAnonymousRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { invalidateCache } from "@/lib/redis";
import { auth } from "@/lib/auth";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";

/**
 * Record one COMPLETED quiz round.
 *
 * Play counts come from this ledger, never from the answer count: a "main" is a
 * finished batch. Correctness is re-derived here from the per-answer GameScore
 * rows, so the client cannot forge its round score.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (body == null) return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });

    const parsed = submitGameRoundSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validasi gagal" },
        { status: 400 },
      );
    }

    const { gameType, roundId, playerName } = parsed.data;
    // De-dupe ids: the same question cannot be answered twice (unique(userId,
    // questionId)), and a repeated id would inflate `totalQuestions`.
    const questionIds = [...new Set(parsed.data.questionIds)];

    const session = await auth();
    const isAuthed = !!session?.user?.id;

    if (!isAuthed && !playerName) {
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

    // Every question must exist and belong to the round's game type.
    const questions = await prisma.gameQuestion.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, type: true },
    });
    if (
      questions.length !== questionIds.length ||
      questions.some((q) => q.type !== gameType)
    ) {
      return NextResponse.json({ error: "Pertanyaan tidak valid untuk game ini" }, { status: 400 });
    }

    // Server-side score: the answers for this batch are already in GameScore.
    const answers = await prisma.gameScore.findMany({
      where: isAuthed
        ? { userId: session!.user.id, questionId: { in: questionIds } }
        : { playerName: playerName!, questionId: { in: questionIds } },
      select: { isCorrect: true },
    });
    if (answers.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada jawaban tercatat untuk babak ini" },
        { status: 409 },
      );
    }

    const dedupeKey = `${isAuthed ? `user:${session!.user.id}` : `guest:${playerName}`}:${roundId}`;

    try {
      const round = await prisma.gameRound.create({
        data: {
          gameType,
          userId: isAuthed ? session!.user.id : undefined,
          playerName: isAuthed ? undefined : playerName,
          correct: answers.filter((a) => a.isCorrect).length,
          totalQuestions: questionIds.length,
          dedupeKey,
        },
        select: {
          id: true,
          gameType: true,
          correct: true,
          totalQuestions: true,
          playedAt: true,
        },
      });

      await invalidateCache("games:*");
      await invalidateCache("home:*");

      if (isAuthed) {
        const coupleId = await getUserCoupleId(session!.user.id);
        if (coupleId) {
          await triggerCoupleEvent(coupleId, "GAMES_LEADERBOARD");
        }
      }

      return NextResponse.json({ data: round }, { status: 201 });
    } catch (error) {
      // Retried submit (double click / network retry): return the recorded row.
      if ((error as { code?: string })?.code === "P2002") {
        const existing = await prisma.gameRound.findUnique({
          where: { dedupeKey },
          select: {
            id: true,
            gameType: true,
            correct: true,
            totalQuestions: true,
            playedAt: true,
          },
        });
        if (existing) return NextResponse.json({ data: existing });
        return NextResponse.json({ error: "Babak sudah tercatat" }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    console.error("Error recording game round:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
