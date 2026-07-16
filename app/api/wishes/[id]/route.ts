import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { updateWishSchema } from "@/lib/validations/wish";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { invalidateCache } from "@/lib/redis";
import { deleteFromCloudinaryUrl } from "@/lib/cloudinary";
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
    const body = await request.json();
    const parsed = updateWishSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data wish tidak valid" },
        { status: 400 },
      );
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (data.isDone === true) {
      data.doneAt = new Date();
    }

    // Fetch old imageUrl before update so we can clean up if changed
    let oldImageUrl: string | null = null;
    if ("imageUrl" in data) {
      const existing = await prisma.wishItem.findUnique({
        where: { id },
        select: { imageUrl: true },
      });
      oldImageUrl = existing?.imageUrl ?? null;
    }

    const wish = await prisma.wishItem.update({
      where: { id },
      data,
      select: {
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
      },
    });

    // Delete old Cloudinary image if changed
    if (oldImageUrl && oldImageUrl !== wish.imageUrl) {
      await deleteFromCloudinaryUrl(oldImageUrl).catch(console.error);
    }

    await invalidateCache("wishes:*");

    const coupleId = await getUserCoupleId(rateCheck.session.user.id);
    if (coupleId) {
      triggerCoupleEvent(coupleId, 'WISHLIST');
    }

    return NextResponse.json({ data: wish });
  } catch (error) {
    console.error("Error updating wish:", error);
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

    // Fetch imageUrl before deleting so we can clean up Cloudinary
    const wish = await prisma.wishItem.findUnique({
      where: { id },
      select: { imageUrl: true },
    });

    await prisma.wishItem.delete({ where: { id } });

    // Delete from Cloudinary if it was stored there
    if (wish?.imageUrl) {
      await deleteFromCloudinaryUrl(wish.imageUrl).catch(console.error);
    }

    await invalidateCache("wishes:*");

    const coupleId = await getUserCoupleId(rateCheck.session.user.id);
    if (coupleId) {
      triggerCoupleEvent(coupleId, 'WISHLIST');
    }

    return NextResponse.json({ message: "Wish deleted" });
  } catch (error) {
    console.error("Error deleting wish:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
