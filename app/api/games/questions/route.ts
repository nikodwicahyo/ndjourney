import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { createQuestionSchema } from "@/lib/validations/game";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { getCached, setCached, invalidateCache, cacheKey } from "@/lib/redis";

const CACHE_TTL = 600;

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

    if (random) {
      const count = parseInt(random);
      questions = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT id, type::text, question, "optionA", "optionB", answer, category, "createdAt"
         FROM "GameQuestion"
         WHERE "type" = CAST($1 AS "GameType")${category ? ` AND category = $2` : ""}
         ORDER BY RANDOM()
         LIMIT $${category ? "3" : "2"}`,
        type,
        ...(category ? [category] : []),
        count,
      );
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

    const response = { data: questions };

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

    return NextResponse.json({ data: question }, { status: 201 });
  } catch (error) {
    console.error("Error creating question:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
