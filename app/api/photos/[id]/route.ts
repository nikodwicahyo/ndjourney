import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updatePhotoSchema } from "@/lib/validations/photo";
import { deleteFromCloudinary } from "@/lib/cloudinary";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { getCached, setCached, invalidateCache, cacheKey } from "@/lib/redis";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";

const CACHE_TTL_AUTH = 120;
const CACHE_TTL_PUBLIC = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    const isAuthed = !!session?.user;

    const { id } = await params;

    const scope = isAuthed ? "auth" : "public";
    const callerCoupleId = session?.user ? await getUserCoupleId(session.user.id) : null;
    const cacheK = cacheKey("photos", "detail", scope, callerCoupleId ?? "nocouple", id);
    const cached = await getCached<unknown>(cacheK);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "private, no-cache" },
      });
    }

    const photo = await prisma.photo.findUnique({
      where: { id },
      select: {
        id: true,
        url: true,
        publicId: true,
        thumbnailUrl: true,
        caption: true,
        takenAt: true,
        width: true,
        height: true,
        fileSize: true,
        isVideo: true,
        isFavorite: true,
        isPublic: true,
        albumId: true,
        coupleId: true,
        uploadedById: true,
        isMilestoneOnly: true,
        createdAt: true,
        updatedAt: true,
        uploadedBy: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    if (!photo) {
      return NextResponse.json({ error: "Media tidak ditemukan" }, { status: 404 });
    }

    // SEC: any-authed horizontal read — couple-scope the authed path like PUT/DELETE.
    // Public photos stay viewable (same gate as anon); anything else needs ownership.
    let authedVisible = !isAuthed;
    if (isAuthed) {
      const ownerCoupleId = (photo as { coupleId?: string | null }).coupleId ?? null;
      if (ownerCoupleId !== null ? ownerCoupleId === callerCoupleId : photo.uploadedById === session?.user?.id) {
        authedVisible = true;
      } else if (!photo.isMilestoneOnly && photo.isPublic) {
        if (!photo.albumId) {
          authedVisible = true;
        } else {
          const album = await prisma.album.findUnique({
            where: { id: photo.albumId },
            select: { isPublic: true },
          });
          authedVisible = !!album?.isPublic;
        }
      }
      if (!authedVisible) {
        return NextResponse.json({ error: "Media tidak ditemukan" }, { status: 404 });
      }
    }

    // Enforce visibility rules for unauthenticated callers matching the list endpoint:
    // photo must be public AND (unfiled OR in a public album). 404 (not 403) to avoid leaking existence.
    if (!isAuthed) {
      if (photo.isMilestoneOnly) {
        return NextResponse.json({ error: "Media tidak ditemukan" }, { status: 404 });
      }
      if (!photo.isPublic) {
        return NextResponse.json({ error: "Media tidak ditemukan" }, { status: 404 });
      }
      if (photo.albumId) {
        const album = await prisma.album.findUnique({
          where: { id: photo.albumId },
          select: { isPublic: true },
        });
        if (!album || !album.isPublic) {
          return NextResponse.json({ error: "Media tidak ditemukan" }, { status: 404 });
        }
      }
    }

    // Strip internal fields from the response
    const { isMilestoneOnly, coupleId: _coupleId, ...publicPhoto } = photo;
    const response = { data: publicPhoto };

    await setCached(cacheK, response, isAuthed ? CACHE_TTL_AUTH : CACHE_TTL_PUBLIC);

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (error) {
    console.error("Error fetching photo:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}

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
    const userId = rateCheck.session.user.id;

    // P-04: one couple lookup per request (was 3 serially).
    const callerCoupleId = await getUserCoupleId(userId);

    const existing = await prisma.photo.findUnique({
      where: { id },
      select: { coupleId: true, uploadedById: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Media tidak ditemukan" }, { status: 404 });
    }
    if (existing.coupleId) {
      if (existing.coupleId !== callerCoupleId) {
        return NextResponse.json({ error: "Kamu tidak punya akses untuk mengubah media ini" }, { status: 403 });
      }
    } else if (existing.uploadedById !== userId) {
      return NextResponse.json({ error: "Kamu tidak punya akses untuk mengubah media ini" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (body == null) return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    const parsed = updatePhotoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak valid" },
        { status: 400 },
      );
    }

    const ALLOWED_COLUMNS = new Set(["caption", "albumId", "isFavorite", "isPublic"]);

    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined && ALLOWED_COLUMNS.has(key)) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Tidak ada perubahan yang dikirim" }, { status: 400 });
    }

    if (typeof updateData.albumId === "string") {
      const target = await prisma.album.findUnique({
        where: { id: updateData.albumId as string },
        select: { id: true, coupleId: true },
      });
      if (!target || (target.coupleId !== null && target.coupleId !== callerCoupleId)) {
        return NextResponse.json({ error: "Album tidak ditemukan" }, { status: 400 });
      }
    }

    const photo = await prisma.photo.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        url: true,
        publicId: true,
        thumbnailUrl: true,
        caption: true,
        takenAt: true,
        width: true,
        height: true,
        fileSize: true,
        isVideo: true,
        isFavorite: true,
        isPublic: true,
        albumId: true,
        uploadedById: true,
        createdAt: true,
        updatedAt: true,
        uploadedBy: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    await Promise.all([
      invalidateCache("photos:*"),
      invalidateCache("albums:*"),
      invalidateCache("dashboard:*"),
      invalidateCache("home:*"),
    ]);

    if (callerCoupleId) {
      triggerCoupleEvent(callerCoupleId, 'GALLERY');
    }

    return NextResponse.json({ data: photo });
  } catch (error) {
    console.error("Error updating photo:", error);
    // stale albumId FK -> 400, not generic 500
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2003") {
      return NextResponse.json({ error: "Album tidak ditemukan" }, { status: 400 });
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
    const userId = rateCheck.session.user.id;

    const photo = await prisma.photo.findUnique({
      where: { id },
      select: { publicId: true, coupleId: true, uploadedById: true, isVideo: true },
    });

    if (!photo) {
      return NextResponse.json({ error: "Media tidak ditemukan" }, { status: 404 });
    }
    if (photo.coupleId) {
      const userCoupleId = await getUserCoupleId(userId);
      if (photo.coupleId !== userCoupleId) {
        return NextResponse.json({ error: "Kamu tidak punya akses untuk menghapus media ini" }, { status: 403 });
      }
    } else if (photo.uploadedById !== userId) {
      return NextResponse.json({ error: "Kamu tidak punya akses untuk menghapus media ini" }, { status: 403 });
    }

    // Do not remove the database record unless Cloudinary confirms deletion.
    await deleteFromCloudinary(photo.publicId, photo.isVideo ? "video" : "image");
    await prisma.photo.delete({ where: { id } });

    await Promise.all([
      invalidateCache("photos:*"),
      invalidateCache("albums:*"),
      invalidateCache("dashboard:*"),
      invalidateCache("home:*"),
      invalidateCache("storage:*"),
    ]);

    // P-04: reuse the ownership-check lookup (was a 2nd serial call).
    const deleteCoupleId = photo.coupleId ?? null;
    if (deleteCoupleId) {
      triggerCoupleEvent(deleteCoupleId, 'GALLERY');
    }

    return NextResponse.json({ data: { id } });
  } catch (error) {
    console.error("Error deleting photo:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
