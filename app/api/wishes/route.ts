import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createWishSchema } from "@/lib/validations/wish";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { getCached, setCached, invalidateCache, cacheKey } from "@/lib/redis";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";

const CACHE_TTL = 30;

const wishSelect = {
  id: true,
  title: true,
  description: true,
  imageUrl: true,
  imageCrop: true,
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
    if (!session?.user) {
      return NextResponse.json({ data: [], total: 0, page: 1, limit: 50 });
    }
    const coupleId = await getUserCoupleId(session.user.id);
    if (!coupleId) {
      return NextResponse.json({ data: [], total: 0, page: 1, limit: 50 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.min(Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1), 1000);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1), 100);

    const cacheK = cacheKey("wishes", "list", coupleId, String(page), String(limit));
    const cached = await getCached<unknown>(cacheK);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "private, no-cache" },
      });
    }

    const where = { OR: [{ coupleId }, { coupleId: null }] };

    const [wishes, total] = await Promise.all([
      prisma.wishItem.findMany({
        where,
        orderBy: [
          { isDone: "asc" },
          { createdAt: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
        select: wishSelect,
      }),
      prisma.wishItem.count({ where }),
    ]);

    const response = { data: wishes, total, page, limit };

    await setCached(cacheK, response, CACHE_TTL);

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (error) {
    console.error("Error fetching wishes:", error);
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

    const body = await request.json().catch(() => null);
    if (body == null) return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    const parsed = createWishSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data wish tidak valid" },
        { status: 400 },
      );
    }

    const userId = rateCheck.session.user.id;
    const wishCoupleId = await getUserCoupleId(userId);

    // omit null crop on create (DB default is NULL; Json fields reject plain null).
    const { imageCrop, ...rest } = parsed.data;
    const wish = await prisma.wishItem.create({
      data: { ...rest, ...(imageCrop ? { imageCrop } : {}), coupleId: wishCoupleId },
    });

    await invalidateCache("wishes:*");
    await invalidateCache("home:*");

    if (wishCoupleId) {
      triggerCoupleEvent(wishCoupleId, 'WISHLIST');
    }

    return NextResponse.json({ data: wish }, { status: 201 });
  } catch (error) {
    console.error("Error creating wish:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
