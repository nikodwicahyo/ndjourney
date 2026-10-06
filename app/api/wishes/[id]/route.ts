import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
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
    const body = await request.json().catch(() => null);
    if (body == null) return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    const parsed = updateWishSchema.safeParse(body);

    // ownership gate — legacy rows have null coupleId (lenient), new rows are scoped.
    // P-04: single row read serves gate + old-image cleanup (was 2 serial findUniques).
    const [owner, callerCoupleId] = await Promise.all([
      prisma.wishItem.findUnique({
        where: { id },
        select: { coupleId: true, imageUrl: true },
      }),
      getUserCoupleId(rateCheck.session.user.id),
    ]);
    if (!owner || (owner.coupleId !== null && owner.coupleId !== callerCoupleId)) {
      return NextResponse.json({ error: "Wish tidak ditemukan" }, { status: 404 });
    }

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data wish tidak valid" },
        { status: 400 },
      );
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (data.isDone === true) {
      data.doneAt = new Date();
    } else if (data.isDone === false) {
      data.doneAt = null;
    }
    // explicit null clears the crop (DbNull = SQL NULL, not JSON null);
    // dropping the image always drops its crop.
    if (data.imageUrl === null || data.imageCrop === null) {
      data.imageCrop = Prisma.DbNull;
    }

    // Fetch old imageUrl before update so we can clean up if changed
    const oldImageUrl = "imageUrl" in data ? (owner.imageUrl ?? null) : null;

    const wish = await prisma.wishItem.update({
      where: { id },
      data,
      select: {
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
      },
    });

    // Delete old Cloudinary image if changed — but never a gallery-referenced
    // URL (gallery-picked wish images share the original file).
    if (oldImageUrl && oldImageUrl !== wish.imageUrl) {
      const stillReferenced = await prisma.photo.findFirst({
        where: { url: oldImageUrl },
        select: { id: true },
      });
      if (!stillReferenced) {
        await deleteFromCloudinaryUrl(oldImageUrl).catch(console.error);
      }
    }

    await invalidateCache("wishes:*");
    await invalidateCache("home:*");

    if (callerCoupleId) {
      triggerCoupleEvent(callerCoupleId, 'WISHLIST');
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

    // ownership gate (see PUT above).
    // P-04: gate + deleter couple in parallel (was 2 serial).
    const [target, deleterCoupleId] = await Promise.all([
      prisma.wishItem.findUnique({
        where: { id },
        select: { coupleId: true, imageUrl: true },
      }),
      getUserCoupleId(rateCheck.session.user.id),
    ]);
    if (!target || (target.coupleId !== null && target.coupleId !== deleterCoupleId)) {
      return NextResponse.json({ error: "Wish tidak ditemukan" }, { status: 404 });
    }

    // Fetch imageUrl before deleting so we can clean up Cloudinary
    const wish = target;

    await prisma.wishItem.delete({ where: { id } });

    // Delete from Cloudinary if it was stored there — never a
    // gallery-referenced URL (shared original must survive).
    if (wish?.imageUrl) {
      const stillReferenced = await prisma.photo.findFirst({
        where: { url: wish.imageUrl },
        select: { id: true },
      });
      if (!stillReferenced) {
        await deleteFromCloudinaryUrl(wish.imageUrl).catch(console.error);
      }
    }

    await invalidateCache("wishes:*");
    await invalidateCache("home:*");

    if (deleterCoupleId) {
      triggerCoupleEvent(deleterCoupleId, 'WISHLIST');
    }

    return NextResponse.json({ data: { id } });
  } catch (error) {
    console.error("Error deleting wish:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
