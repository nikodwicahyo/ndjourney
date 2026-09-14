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
    const body = await request.json().catch(() => null);
    if (body == null) return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    const parsed = updateAlbumSchema.safeParse(body);

    // ponytail: ownership gate — legacy albums have null coupleId (lenient).
    const albumOwner = await prisma.album.findUnique({
      where: { id },
      select: { coupleId: true },
    });
    const editorCoupleId = await getUserCoupleId(rateCheck.session.user.id);
    if (!albumOwner || (albumOwner.coupleId !== null && albumOwner.coupleId !== editorCoupleId)) {
      return NextResponse.json({ error: "Album tidak ditemukan" }, { status: 404 });
    }

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
      return NextResponse.json({ error: "Album tidak ditemukan", code: "P2025" }, { status: 404 });
    }
    const code = (error as { code?: string })?.code;
    // ponytail: DB-unreachable / schema drift must read 503 (retryable), not 500.
    if (code && (/^P1(001|002|008|017|019|020)$/.test(code) || code === "P2022")) {
      return NextResponse.json(
        { error: "Database tidak dapat dijangkau. Coba lagi nanti.", code },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti.", code: "INTERNAL" },
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

    // ponytail: ownership gate (see PUT above).
    const doomed = await prisma.album.findUnique({
      where: { id },
      select: { coupleId: true },
    });
    const deleterCoupleId = await getUserCoupleId(rateCheck.session.user.id);
    if (!doomed || (doomed.coupleId !== null && doomed.coupleId !== deleterCoupleId)) {
      return NextResponse.json({ error: "Album tidak ditemukan" }, { status: 404 });
    }

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
      return NextResponse.json({ error: "Album tidak ditemukan", code: "P2025" }, { status: 404 });
    }
    const code = (error as { code?: string })?.code;
    // ponytail: DB-unreachable / schema drift must read 503 (retryable), not 500.
    if (code && (/^P1(001|002|008|017|019|020)$/.test(code) || code === "P2022")) {
      return NextResponse.json(
        { error: "Database tidak dapat dijangkau. Coba lagi nanti.", code },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti.", code: "INTERNAL" },
      { status: 500 },
    );
  }
}
