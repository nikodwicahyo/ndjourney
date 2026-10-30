import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { createQuestionSchema } from "@/lib/validations/game";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { invalidateCache } from "@/lib/redis";
import { listGameQuestions } from "@/lib/queries/games";
import { auth } from "@/lib/auth";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const category = searchParams.get("category");
    const random = searchParams.get("random");
    const sort = searchParams.get("sort") || "desc";
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "200", 10) || 200, 1), 200);
    const allowedTypes = new Set(["WOULD_YOU_RATHER", "TRIVIA", "SPIN_THE_WHEEL", "TRUTH_OR_DARE"]);
    if (type && !allowedTypes.has(type)) {
      return NextResponse.json({ error: "Tipe pertanyaan tidak valid" }, { status: 400 });
    }

    let randomOpts: { count: number; excludeIds: string[]; answeredBy?: string } | null = null;
    const wantsAnswers = searchParams.get("includeAnswer") === "1";
    const session = random || wantsAnswers ? await auth() : null;

    if (random) {
      const count = Math.min(Math.max(parseInt(random) || 10, 1), 50);
      const excludeParam = searchParams.get("exclude");
      const excludeIds = excludeParam ? excludeParam.split(",").filter(Boolean) : [];
      const cycle = searchParams.get("cycle") === "1";
      randomOpts = { count, excludeIds, answeredBy: cycle ? undefined : session?.user?.id };
    }

    // SEC: the answer key is for the dashboard CRUD view only. Anonymous and
    // unscoped callers get the public shape; grading happens server-side.
    const includeAnswer =
      wantsAnswers && !!session?.user?.id && !!(await getUserCoupleId(session.user.id));

    const response = await listGameQuestions({
      type,
      category,
      sort,
      limit,
      includeAnswer,
      random: randomOpts,
    });

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (error) {
    console.error("Error fetching questions:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.write);
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

    // shared question bank is curated by couple members only.
    const creatorCoupleId = await getUserCoupleId(rateCheck.session.user.id);
    if (!creatorCoupleId) {
      return NextResponse.json({ error: "Pasangan belum ditemukan" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (body == null) return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    const parsed = createQuestionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validasi gagal" },
        { status: 400 },
      );
    }

    const question = await prisma.gameQuestion.create({
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

    await triggerCoupleEvent(creatorCoupleId, 'GAMES_QUESTIONS');

    return NextResponse.json({ data: question }, { status: 201 });
  } catch (error) {
    console.error("Error creating question:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
