import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createMilestoneSchema } from "@/lib/validations/milestone";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { invalidateCache } from "@/lib/redis";
import { batchLoadUsers } from "@/lib/batch";
import { parseJakartaDateOnly } from "@/lib/date";

export async function GET(request: Request) {
  try {
    const session = await auth();
    const isAuthed = !!session?.user;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where = isAuthed ? {} : { isPublic: true };

    const milestones = await prisma.milestone.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
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

    const total = await prisma.milestone.count({ where });

    const userIds = milestones.map((m) => m.createdById);
    const milestoneIds = milestones.map((m) => m.id);

    const [userMap, photoRecords] = await Promise.all([
      batchLoadUsers(userIds),
      milestoneIds.length > 0
        ? prisma.milestonePhoto.findMany({
            where: { milestoneId: { in: milestoneIds } },
            include: {
              photo: {
                select: { id: true, url: true, thumbnailUrl: true, caption: true },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const photosByMilestone = new Map<string, Array<{ milestoneId: string; photo: { id: string; url: string; thumbnailUrl: string | null; caption: string | null } }>>();
    for (const rec of photoRecords) {
      const existing = photosByMilestone.get(rec.milestoneId);
      if (existing) {
        existing.push(rec);
      } else {
        photosByMilestone.set(rec.milestoneId, [rec]);
      }
    }

    const data = milestones.map((m) => ({
      ...m,
      createdBy: userMap.get(m.createdById) ?? null,
      photos: photosByMilestone.get(m.id) ?? [],
    }));

    const response = { data, total, page, limit };

    return NextResponse.json(response, {
      headers: { "Cache-Control": isAuthed ? "private, s-maxage=60" : "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("Error fetching milestones:", error);
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

    const session = rateCheck.session;

    const body = await request.json();
    const parsed = createMilestoneSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 },
      );
    }

    const { photoIds, photoUploads, date: dateStr, ...milestoneData } = parsed.data;

    const date = parseJakartaDateOnly(dateStr);
    if (!date) {
      return NextResponse.json({ error: "Tanggal milestone tidak valid" }, { status: 400 });
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

    const milestone = await prisma.milestone.create({
      data: {
        ...milestoneData,
        date,
        createdById: session.user.id,
        photos: allPhotoIds.length
          ? {
              create: allPhotoIds.map((photoId) => ({ photoId })),
            }
          : undefined,
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
        photos: {
          select: {
            photoId: true,
            photo: {
              select: { id: true, url: true, thumbnailUrl: true, caption: true },
            },
          },
        },
      },
    });

    const userMap = await batchLoadUsers([milestone.createdById]);
    const data = { ...milestone, createdBy: userMap.get(milestone.createdById) ?? null };

    await invalidateCache("milestones:*");
    await invalidateCache("dashboard:*");

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Error creating milestone:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
