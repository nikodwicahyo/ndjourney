import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { updateQuestionSchema } from "@/lib/validations/game";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { invalidateCache } from "@/lib/redis";
import { getGameQuestionById } from "@/lib/queries/games";
import { auth } from "@/lib/auth";
import { getUserCoupleId } from "@/lib/couple";
import { emitActivity } from "@/lib/activity";

/**
 * Single-question read for dashboard deep links (`?question=<id>`). Keeps
 * working when the row sits outside the first page of the tab list. The
 * answer key follows the same couple-membership gate as the listing.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await auth();
    const includeAnswer =
      !!session?.user?.id && !!(await getUserCoupleId(session.user.id));

    const question = await getGameQuestionById(id, includeAnswer);
    if (!question) {
      return NextResponse.json(
        { error: "Pertanyaan tidak ditemukan" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { data: question },
      { headers: { "Cache-Control": "private, no-cache" } },
    );
  } catch (error) {
    console.error("Error fetching question:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}

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

    // shared bank curated by couple members only (see POST gate).
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
    await invalidateCache("home:*");

    const coupleId = await getUserCoupleId(rateCheck.session.user.id);
    if (coupleId) {
      await emitActivity(coupleId, rateCheck.session.user.id, {
        type: "questions",
        action: "updated",
        title: "Bank soal games",
        body: `${rateCheck.session.user.name || "Pasangan"} memperbarui bank soal games`,
        href: `/dashboard/games?question=${id}`,
        level: "both",
      });
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

    // shared bank curated by couple members only (see PUT gate).
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
    await invalidateCache("home:*");

    const coupleId = await getUserCoupleId(rateCheck.session.user.id);
    if (coupleId) {
      await emitActivity(coupleId, rateCheck.session.user.id, {
        type: "questions",
        action: "updated",
        title: "Bank soal games",
        body: `${rateCheck.session.user.name || "Pasangan"} memperbarui bank soal games`,
        href: `/dashboard/games?question=${id}`,
        level: "both",
      });
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
