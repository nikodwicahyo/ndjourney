import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { updateAlbumSchema } from "@/lib/validations/photo";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { invalidateCache } from "@/lib/redis";
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
    const parsed = updateAlbumSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data album tidak valid" },
        { status: 400 },
      );
    }

    const album = await prisma.album.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        name: true,
        description: true,
        coverPhotoUrl: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { photos: true } },
      },
    });

    await invalidateCache("albums:*");

    const coupleId = await getUserCoupleId(rateCheck.session.user.id);
    if (coupleId) {
      triggerCoupleEvent(coupleId, 'GALLERY');
    }

    return NextResponse.json({ data: album });
  } catch (error) {
    console.error("Error updating album:", error);
    // ponytail: missing album -> 404, not 500
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Album tidak ditemukan" }, { status: 404 });
    }
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

    // ponytail: atomic detach+delete — no partial state if delete throws after detach
    await prisma.$transaction([
      prisma.photo.updateMany({
        where: { albumId: id },
        data: { albumId: null },
      }),
      prisma.album.delete({ where: { id } }),
    ]);

    await invalidateCache("albums:*");
    await invalidateCache("photos:*");

    const coupleId = await getUserCoupleId(rateCheck.session.user.id);
    if (coupleId) {
      triggerCoupleEvent(coupleId, 'GALLERY');
    }

    return NextResponse.json({ message: "Album deleted" });
  } catch (error) {
    console.error("Error deleting album:", error);
    // ponytail: missing album -> 404, not 500
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Album tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
