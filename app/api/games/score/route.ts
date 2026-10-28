import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { submitScoreSchema } from "@/lib/validations/game";
import { withRateLimit, withAnonymousRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { invalidateCache } from "@/lib/redis";
import { auth } from "@/lib/auth";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";
import { isAnswerCorrect } from "@/lib/game-answer";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (body == null) return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
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

    // SEC: the answer never leaves the server for grading. The client submits
    // what the player chose; correctness is derived here.
    const question = await prisma.gameQuestion.findUnique({
      where: { id: parsed.data.questionId },
      select: { type: true, answer: true, isArchived: true },
    });
    if (!question || question.isArchived) {
      return NextResponse.json({ error: "Pertanyaan tidak ditemukan" }, { status: 404 });
    }

    const correct = isAnswerCorrect(question.type, question.answer, parsed.data.selectedAnswer);
    if (correct === null) {
      return NextResponse.json(
        { error: "Tipe pertanyaan ini tidak mendukung skor" },
        { status: 400 },
      );
    }

    const existingScore = isAuthed
      ? await prisma.gameScore.findFirst({
          where: { userId: session!.user.id, questionId: parsed.data.questionId },
          select: { id: true, isCorrect: true },
        })
      : await prisma.gameScore.findFirst({
          where: { playerName: parsed.data.playerName!, questionId: parsed.data.questionId },
          select: { id: true, isCorrect: true },
        });

    // Idempotent re-answer: return the recorded result so the client can still
    // reveal the answer (the deck recycles questions once the bank is spent).
    if (existingScore) {
      return NextResponse.json({
        data: existingScore,
        correct: existingScore.isCorrect,
        answer: question.answer,
      });
    }

    const score = await prisma.gameScore.create({
      data: {
        userId: isAuthed ? session!.user.id : undefined,
        playerName: isAuthed ? undefined : parsed.data.playerName!,
        questionId: parsed.data.questionId,
        isCorrect: correct,
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
    await invalidateCache("home:*");

    if (isAuthed) {
      const coupleId = await getUserCoupleId(session!.user.id);
      if (coupleId) {
        await triggerCoupleEvent(coupleId, 'GAMES_LEADERBOARD');
      }
    }

    return NextResponse.json(
      { data: score, correct, answer: question.answer },
      { status: 201 },
    );
  } catch (error) {
    // unique(userId,questionId) turns a double-submit race into P2002.
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json(
        { error: "Kamu sudah menjawab pertanyaan ini" },
        { status: 409 },
      );
    }
    console.error("Error recording score:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
