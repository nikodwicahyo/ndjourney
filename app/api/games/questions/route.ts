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
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "200", 10) || 200, 1), 200);
    const allowedTypes = new Set(["WOULD_YOU_RATHER", "TRIVIA", "SPIN_THE_WHEEL", "TRUTH_OR_DARE"]);
    if (type && !allowedTypes.has(type)) {
      return NextResponse.json({ error: "Tipe pertanyaan tidak valid" }, { status: 400 });
    }

    const cacheK = cacheKey("games", "questions", type ?? "all", category ?? "all", sort, random ?? "0", String(limit));
    const cached = random ? null : await getCached<unknown>(cacheK);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "private, no-cache" },
      });
    }

    const where: Record<string, unknown> = { isArchived: false };
    if (type) where.type = type;
    if (category) where.category = category;

    let questions;

    let totalCount = 0;

    if (random) {
      // MR-12: clamp + DB-side prefilter — the old path loaded the ENTIRE
      // bank into memory and shuffled in JS (O(table) per game start).
      const count = Math.min(Math.max(parseInt(random) || 10, 1), 50);
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

      const excluded = [...answeredIds];
      // Over-fetch 3x so the JS shuffle still has entropy; answered rows are
      // only fetched as a fallback fill below.
      const fresh = await prisma.gameQuestion.findMany({
        where: excluded.length > 0 ? { ...where, id: { notIn: excluded } } : where,
        take: count * 3,
        select: {
          id: true, type: true, question: true, optionA: true, optionB: true,
          answer: true, category: true, createdAt: true,
        },
      });

      const picked = shuffleArray(fresh).slice(0, count);

      if (picked.length < count && excluded.length > 0) {
        // Bank exhausted for this player — recycle answered questions.
        const recycled = await prisma.gameQuestion.findMany({
          where: { ...where, id: { in: excluded } },
          take: count - picked.length,
          select: {
            id: true, type: true, question: true, optionA: true, optionB: true,
            answer: true, category: true, createdAt: true,
          },
        });
        picked.push(...shuffleArray(recycled));
      }

      totalCount = await prisma.gameQuestion.count({ where });
      questions = picked;
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
