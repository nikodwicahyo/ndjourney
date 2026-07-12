import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createWishSchema } from "@/lib/validations/wish";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { getCached, setCached, invalidateCache, cacheKey } from "@/lib/redis";

const CACHE_TTL = 30;

const wishSelect = {
  id: true,
  title: true,
  description: true,
  imageUrl: true,
  link: true,
  category: true,
  isDone: true,
  doneAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const cacheK = cacheKey("wishes", "list", String(page), String(limit));
    const cached = await getCached<unknown>(cacheK);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
      });
    }

    const [wishes, total] = await Promise.all([
      prisma.wishItem.findMany({
        orderBy: [
          { isDone: "asc" },
          { createdAt: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
        select: wishSelect,
      }),
      prisma.wishItem.count(),
    ]);

    const response = { data: wishes, total, page, limit };

    await setCached(cacheK, response, CACHE_TTL);

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, s-maxage=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("Error fetching wishes:", error);
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
    const parsed = createWishSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 },
      );
    }

    const wish = await prisma.wishItem.create({
      data: parsed.data,
    });

    await invalidateCache("wishes:*");

    return NextResponse.json({ data: wish }, { status: 201 });
  } catch (error) {
    console.error("Error creating wish:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
