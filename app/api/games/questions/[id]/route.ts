import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { updateQuestionSchema } from "@/lib/validations/game";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { invalidateCache } from "@/lib/redis";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.write);
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (body == null) return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    const parsed = updateQuestionSchema.safeParse(body);

    // ponytail: shared bank curated by couple members only (see POST gate).
    if (!(await getUserCoupleId(rateCheck.session.user.id))) {
      return NextResponse.json({ error: "Pasangan belum ditemukan" }, { status: 403 });
    }

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validasi gagal" },
        { status: 400 },
      );
    }

    const question = await prisma.gameQuestion.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        type: true,
        question: true,
        optionA: true,
        optionB: true,
        answer: true,
        category: true,
        createdAt: true,
      },
    });

    await invalidateCache("games:*");

    const coupleId = await getUserCoupleId(rateCheck.session.user.id);
    if (coupleId) {
      await triggerCoupleEvent(coupleId, 'GAMES_QUESTIONS');
    }

    return NextResponse.json({ data: question });
  } catch (error) {
    console.error("Error updating question:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.write);
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

    const { id } = await params;

    // ponytail: shared bank curated by couple members only (see PUT gate).
    if (!(await getUserCoupleId(rateCheck.session.user.id))) {
      return NextResponse.json({ error: "Pasangan belum ditemukan" }, { status: 403 });
    }

    // Check for existing scores
    const scoreCount = await prisma.gameScore.count({ where: { questionId: id } });
    let message = "Question deleted";
    if (scoreCount > 0) {
      await prisma.gameQuestion.update({
        where: { id },
        data: { isArchived: true },
      });
      message = "Question archived";
    } else {
      await prisma.gameQuestion.delete({ where: { id } });
    }

    await invalidateCache("games:*");

    const coupleId = await getUserCoupleId(rateCheck.session.user.id);
    if (coupleId) {
      await triggerCoupleEvent(coupleId, 'GAMES_QUESTIONS');
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Error deleting question:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
