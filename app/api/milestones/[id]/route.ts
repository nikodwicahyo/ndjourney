import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateMilestoneSchema } from "@/lib/validations/milestone";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { parseJakartaDateOnly } from "@/lib/date";
import { invalidateCache } from "@/lib/redis";
import { deleteFromCloudinary } from "@/lib/cloudinary";
import { getUserCoupleId } from "@/lib/couple";
import { isAllowedCloudinaryUrl } from "@/lib/upload-policy";
import { verifyUploadForSave } from "@/lib/upload-verify";
import { triggerCoupleEvent } from "@/lib/pusher-server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    const isAuthed = !!session?.user;

    const { id } = await params;

    const milestone = await prisma.milestone.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        date: true,
        icon: true,
        color: true,
        location: true,
        isPublic: true,
        coupleId: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!milestone) {
      return NextResponse.json(
        { error: "Milestone tidak ditemukan" },
        { status: 404 },
      );
    }

    // Enforce visibility rules for unauthenticated callers matching the list endpoint
    if (!isAuthed && !milestone.isPublic) {
      return NextResponse.json(
        { error: "Milestone tidak ditemukan" },
        { status: 404 },
      );
    }

    // authed callers may only read own couple's milestones (legacy null = shared).
    // P-04: coupleId selected on the first read — no second findUnique, static import.
    if (isAuthed) {
      const callerCoupleId = session?.user ? await getUserCoupleId(session.user.id) : null;
      const ownerCoupleId = (milestone as { coupleId?: string | null }).coupleId ?? null;
      if (ownerCoupleId !== null && ownerCoupleId !== callerCoupleId) {
        return NextResponse.json(
          { error: "Milestone tidak ditemukan" },
          { status: 404 },
        );
      }
    }

    const [user, photos] = await Promise.all([
      prisma.user.findUnique({
        where: { id: milestone.createdById },
        select: { id: true, name: true, image: true },
      }),
      prisma.milestonePhoto.findMany({
        // same public-photo rule as list — anon never gets private photo URLs via a public milestone.
        where: {
          milestoneId: id,
          ...(isAuthed ? {} : {
            photo: {
              isPublic: true,
              OR: [{ albumId: null }, { album: { isPublic: true } }],
            },
          }),
        },
        select: {
          milestoneId: true,
          crop: true,
          photo: {
            select: { id: true, url: true, thumbnailUrl: true, caption: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      data: {
        ...milestone,
        coupleId: undefined,
        createdBy: user ?? null,
        photos,
      },
    }, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (error) {
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
    const session = rateCheck.session;

    const { id } = await params;

    const existingMilestone = await prisma.milestone.findUnique({
      where: { id },
      select: { createdById: true },
    });
    if (!existingMilestone) {
      return NextResponse.json({ error: "Milestone tidak ditemukan" }, { status: 404 });
    }
    if (existingMilestone.createdById !== session.user.id) {
      return NextResponse.json({ error: "Kamu tidak punya akses untuk mengubah milestone ini" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (body == null) return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    const parsed = updateMilestoneSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data milestone tidak valid" },
        { status: 400 },
      );
    }

    const { photoIds, photoUploads, photoCrops, date: dateStr, ...milestoneData } = parsed.data;

    let date: Date | undefined;
    if (dateStr !== undefined) {
      const parsed = parseJakartaDateOnly(dateStr);
      if (!parsed) {
        return NextResponse.json({ error: "Tanggal milestone tidak valid" }, { status: 400 });
      }
      date = parsed;
    }

    // per-item isolation — one bad upload must not 500 the whole update
    const createdPhotos: Array<{ id: string; crop?: { x: number; y: number; w: number; h: number } | null }> = [];
    const failedPhotos: { publicId: string; error: string }[] = [];
    if (photoUploads?.length) {
      const settled = await Promise.allSettled(
        photoUploads.map(async (upload) => {
          // SEC: same end-to-end byte trust as /api/photos — this path
          // previously persisted uploads with no URL checks at all.
          await verifyUploadForSave({
            url: upload.url,
            publicId: upload.publicId,
            userId: session.user.id,
            isVideo: false,
          });
          if (upload.thumbnailUrl && !isAllowedCloudinaryUrl(upload.thumbnailUrl)) {
            throw new Error("URL thumbnail tidak valid");
          }
          return prisma.photo.create({
            data: {
              url: upload.url,
              publicId: upload.publicId,
              thumbnailUrl: upload.thumbnailUrl ?? null,
              uploadedById: session.user.id,
              isMilestoneOnly: true,
            },
            select: { id: true },
          });
        }),
      );
      settled.forEach((r, i) => {
        if (r.status === "fulfilled") createdPhotos.push({ id: r.value.id, crop: photoUploads[i].crop ?? null });
        else failedPhotos.push({ publicId: photoUploads[i].publicId, error: r.reason instanceof Error ? r.reason.message : "Gagal menyimpan foto" });
      });
    }

    const createdPhotoIds = createdPhotos.map((p) => p.id);
    const uploadCropById = new Map(createdPhotos.map((p) => [p.id, p.crop]));
    const allPhotoIds = [...(photoIds ?? []), ...createdPhotoIds];

    if (Array.isArray(photoIds) || photoUploads !== undefined) {
      // Find photos that will be removed and are milestone-only (not shared elsewhere)
      const currentLinks = await prisma.milestonePhoto.findMany({
        where: { milestoneId: id },
        select: { photoId: true },
      });
      const currentPhotoIds = currentLinks.map((l) => l.photoId);
      const keepSet = new Set(allPhotoIds);
      const removedPhotoIds = currentPhotoIds.filter((pid) => !keepSet.has(pid));

      // P-11: link replace + orphan cleanup in one transaction — crash between
      // deleteMany and createMany used to leave the milestone with zero photos.
      // (Cloudinary deletes stay outside: external side-effects can't roll back.)
      const orphanedPhotos = removedPhotoIds.length > 0
        ? await prisma.photo.findMany({
            where: { id: { in: removedPhotoIds }, isMilestoneOnly: true },
            select: { id: true, publicId: true, isVideo: true },
          })
        : [];

      await prisma.$transaction([
        prisma.milestonePhoto.deleteMany({ where: { milestoneId: id } }),
        ...(allPhotoIds.length > 0
          ? [
              prisma.milestonePhoto.createMany({
                data: allPhotoIds.map((pid) => ({
                  milestoneId: id,
                  photoId: pid,
                  crop: uploadCropById.get(pid) ?? photoCrops?.[pid] ?? undefined,
                })),
              }),
            ]
          : []),
        ...(orphanedPhotos.length > 0
          ? [
              prisma.photo.deleteMany({
                where: { id: { in: orphanedPhotos.map((p) => p.id) } },
              }),
            ]
          : []),
      ]);

      if (orphanedPhotos.length > 0) {
        await Promise.allSettled(
          orphanedPhotos.map((p) =>
            deleteFromCloudinary(p.publicId, p.isVideo ? "video" : "image")
          )
        );
      }
    }

    const updated = await prisma.milestone.update({
      where: { id },
      data: {
        ...milestoneData,
        date,
      },
      select: {
        id: true,
        title: true,
        description: true,
        date: true,
        icon: true,
        color: true,
        location: true,
        isPublic: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const [userMap, photos] = await Promise.all([
      prisma.user.findUnique({
        where: { id: updated.createdById },
        select: { id: true, name: true, image: true },
      }),
      prisma.milestonePhoto.findMany({
        where: { milestoneId: id },
        select: {
          milestoneId: true,
          crop: true,
          photo: {
            select: { id: true, url: true, thumbnailUrl: true, caption: true },
          },
        },
      }),
    ]);

    await invalidateCache("milestones:*");
    await invalidateCache("dashboard:*");
    await invalidateCache("home:*");

    const coupleId = await getUserCoupleId(session.user.id);
    if (coupleId) {
      triggerCoupleEvent(coupleId, 'TIMELINE');
    }

    return NextResponse.json({
      data: {
        ...updated,
        createdBy: userMap ?? null,
        photos,
      },
      ...(failedPhotos.length > 0 ? { failedPhotos } : {}),
    });
  } catch (error) {
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

    const existingMilestone = await prisma.milestone.findUnique({
      where: { id },
      select: { createdById: true },
    });
    if (!existingMilestone) {
      return NextResponse.json({ error: "Milestone tidak ditemukan" }, { status: 404 });
    }
    if (existingMilestone.createdById !== userId) {
      return NextResponse.json({ error: "Kamu tidak punya akses untuk menghapus milestone ini" }, { status: 403 });
    }

    // Fetch milestone-only photos to clean from Cloudinary
    const milestoneOnlyPhotos = await prisma.photo.findMany({
      where: {
        milestones: { some: { milestoneId: id } },
        isMilestoneOnly: true,
      },
      select: { id: true, publicId: true, isVideo: true },
    });

    // Cascade delete milestone (MilestonePhoto rows deleted by onDelete: Cascade)
    await prisma.milestone.delete({ where: { id } });

    // Clean up orphaned milestone-only photos from DB and Cloudinary
    if (milestoneOnlyPhotos.length > 0) {
      await Promise.allSettled(
        milestoneOnlyPhotos.map((p) =>
          deleteFromCloudinary(p.publicId, p.isVideo ? "video" : "image")
        )
      );
      await prisma.photo.deleteMany({
        where: { id: { in: milestoneOnlyPhotos.map((p) => p.id) } },
      });
    }

    await invalidateCache("milestones:*");
    await invalidateCache("dashboard:*");
    await invalidateCache("home:*");

    const coupleId = await getUserCoupleId(userId);
    if (coupleId) {
      triggerCoupleEvent(coupleId, 'TIMELINE');
    }

    return NextResponse.json({ data: { id } });
  } catch (error) {
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
