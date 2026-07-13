import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { createQuestionSchema } from "@/lib/validations/game";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { getCached, setCached, invalidateCache, cacheKey } from "@/lib/redis";
import { auth } from "@/lib/auth";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";

const CACHE_TTL = 600;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const category = searchParams.get("category");
    const random = searchParams.get("random");
    const sort = searchParams.get("sort") || "desc";
    const limit = parseInt(searchParams.get("limit") || "200");

    const cacheK = cacheKey("games", "questions", type ?? "all", category ?? "all", sort, random ?? "0", String(limit));
    const cached = random ? null : await getCached<unknown>(cacheK);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" },
      });
    }

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (category) where.category = category;

    let questions;

    let totalCount = 0;

    if (random) {
      const count = parseInt(random);
      const session = await auth();
      const answeredBy = session?.user?.id;

      // Build exclusion set: from server-side GameScore + client-provided exclude param
      const excludeParam = searchParams.get("exclude");
      const excludeFromParam = excludeParam ? excludeParam.split(",").filter(Boolean) : [];

      let answeredIds = new Set<string>(excludeFromParam);

      if (answeredBy) {
        const scores = await prisma.gameScore.findMany({
          where: { userId: answeredBy },
          select: { questionId: true },
        });
        for (const s of scores) answeredIds.add(s.questionId);
      }

      // Get all questions of this type
      const allQuestions = await prisma.gameQuestion.findMany({
        where,
        select: {
          id: true, type: true, question: true, optionA: true, optionB: true,
          answer: true, category: true, createdAt: true,
        },
      });

      totalCount = allQuestions.length;

      // Shuffle for randomness
      const shuffled = shuffleArray(allQuestions);

      // Split: unanswered first, answered/excluded last
      const unanswered = shuffled.filter((q) => !answeredIds.has(q.id));
      const answered = shuffled.filter((q) => answeredIds.has(q.id));

      // Prefer unanswered; if exhausted, recycle answered questions
      questions = [...unanswered, ...answered].slice(0, count);
    } else {
      questions = await prisma.gameQuestion.findMany({
        where,
        take: limit,
        orderBy: { createdAt: sort === "asc" ? "asc" : "desc" },
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
    }

    const response = random
      ? { data: questions, total: totalCount }
      : { data: questions };

    if (!random) {
      await setCached(cacheK, response, CACHE_TTL);
    }

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" },
    });
  } catch (error) {
    console.error("Error fetching questions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
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

    const body = await request.json();
    const parsed = createQuestionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
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

    const coupleId = await getUserCoupleId(rateCheck.session.user.id);
    if (coupleId) {
      triggerCoupleEvent(coupleId, 'GAMES');
    }

    return NextResponse.json({ data: question }, { status: 201 });
  } catch (error) {
    console.error("Error creating question:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
