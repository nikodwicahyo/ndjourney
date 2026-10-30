import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createWishSchema } from "@/lib/validations/wish";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { invalidateCache } from "@/lib/redis";
import { listWishes } from "@/lib/queries/wishes";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";

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

    const response = await listWishes(coupleId, session.user.id, page, limit);

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

    // Never persist a row with no tenant: a missing couple is an internal
    // failure, and an orphan row would silently disappear from the list.
    if (!wishCoupleId) {
      return NextResponse.json(
        { error: "Akun belum terhubung ke couple. Coba muat ulang." },
        { status: 409 },
      );
    }

    // omit null crop on create (DB default is NULL; Json fields reject plain null).
    const { imageCrop, ...rest } = parsed.data;
    const wish = await prisma.wishItem.create({
      data: { ...rest, ...(imageCrop ? { imageCrop } : {}), coupleId: wishCoupleId, createdById: userId },
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
