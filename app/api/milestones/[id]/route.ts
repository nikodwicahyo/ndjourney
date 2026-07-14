import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateMilestoneSchema } from "@/lib/validations/milestone";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { parseJakartaDateOnly } from "@/lib/date";
import { invalidateCache } from "@/lib/redis";
import { deleteFromCloudinary } from "@/lib/cloudinary";
import { getUserCoupleId } from "@/lib/couple";
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
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!milestone) {
      return NextResponse.json(
        { error: "Milestone not found" },
        { status: 404 },
      );
    }

    // Enforce visibility rules for unauthenticated callers matching the list endpoint
    if (!isAuthed && !milestone.isPublic) {
      return NextResponse.json(
        { error: "Milestone not found" },
        { status: 404 },
      );
    }

    const [user, photos] = await Promise.all([
      prisma.user.findUnique({
        where: { id: milestone.createdById },
        select: { id: true, name: true, image: true },
      }),
      prisma.milestonePhoto.findMany({
        where: { milestoneId: id },
        include: {
          photo: {
            select: { id: true, url: true, thumbnailUrl: true, caption: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      data: {
        ...milestone,
        createdBy: user ?? null,
        photos,
      },
    }, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
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
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }
    if (existingMilestone.createdById !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateMilestoneSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 },
      );
    }

    const { photoIds, photoUploads, date: dateStr, ...milestoneData } = parsed.data;

    let date: Date | undefined;
    if (dateStr !== undefined) {
      const parsed = parseJakartaDateOnly(dateStr);
      if (!parsed) {
        return NextResponse.json({ error: "Tanggal milestone tidak valid" }, { status: 400 });
      }
      date = parsed;
    }

    // Create Photo records for newly uploaded images
    const createdPhotoIds: string[] = [];
    if (photoUploads?.length) {
      for (const upload of photoUploads) {
        const photo = await prisma.photo.create({
          data: {
            url: upload.url,
            publicId: upload.publicId,
            thumbnailUrl: upload.thumbnailUrl ?? null,
            uploadedById: session.user.id,
            isMilestoneOnly: true,
          },
        });
        createdPhotoIds.push(photo.id);
      }
    }

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

      if (removedPhotoIds.length > 0) {
        const orphanedPhotos = await prisma.photo.findMany({
          where: { id: { in: removedPhotoIds }, isMilestoneOnly: true },
          select: { id: true, publicId: true, isVideo: true },
        });

        await prisma.milestonePhoto.deleteMany({ where: { milestoneId: id } });

        if (orphanedPhotos.length > 0) {
          await Promise.allSettled(
            orphanedPhotos.map((p) =>
              deleteFromCloudinary(p.publicId, p.isVideo ? "video" : "image")
            )
          );
          await prisma.photo.deleteMany({
            where: { id: { in: orphanedPhotos.map((p) => p.id) } },
          });
        }
      } else {
        await prisma.milestonePhoto.deleteMany({ where: { milestoneId: id } });
      }

      if (allPhotoIds.length > 0) {
        await prisma.milestonePhoto.createMany({
          data: allPhotoIds.map((pid) => ({ milestoneId: id, photoId: pid })),
        });
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
        include: {
          photo: {
            select: { id: true, url: true, thumbnailUrl: true, caption: true },
          },
        },
      }),
    ]);

    await invalidateCache("milestones:*");
    await invalidateCache("dashboard:*");

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
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
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
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }
    if (existingMilestone.createdById !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    const coupleId = await getUserCoupleId(userId);
    if (coupleId) {
      triggerCoupleEvent(coupleId, 'TIMELINE');
    }

    return NextResponse.json({ message: "Milestone deleted" });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
