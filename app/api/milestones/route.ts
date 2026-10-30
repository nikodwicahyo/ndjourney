import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createMilestoneSchema } from "@/lib/validations/milestone";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { invalidateCache } from "@/lib/redis";
import { listMilestones } from "@/lib/queries/milestones";
import { batchLoadUsers } from "@/lib/batch";
import { toPublicUser } from "@/lib/format";
import { parseJakartaDateOnly } from "@/lib/date";
import { getUserCoupleId } from "@/lib/couple";
import { isAllowedCloudinaryUrl } from "@/lib/upload-policy";
import { verifyUploadForSave } from "@/lib/upload-verify";
import { triggerCoupleEvent } from "@/lib/pusher-server";

export async function GET(request: Request) {
  try {
    const session = await auth();
    const isAuthed = !!session?.user;
    const coupleId = session?.user ? await getUserCoupleId(session.user.id) : null;

    const { searchParams } = new URL(request.url);
    const page = Math.min(Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1), 1000);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1), 100);

    const response = await listMilestones({ isAuthed, coupleId, userId: session?.user?.id ?? null, page, limit });

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (error) {
    console.error("Error fetching milestones:", error);
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

    const session = rateCheck.session;

    const body = await request.json().catch(() => null);
    if (body == null) return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    const parsed = createMilestoneSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data milestone tidak valid" },
        { status: 400 },
      );
    }

    const { photoIds, photoUploads, photoCrops, date: dateStr, ...milestoneData } = parsed.data;

    const date = parseJakartaDateOnly(dateStr);
    if (!date) {
      return NextResponse.json({ error: "Tanggal milestone tidak valid" }, { status: 400 });
    }

    const coupleId = await getUserCoupleId(session.user.id);
    // Never persist a row with no tenant (see the wish POST guard).
    if (!coupleId) {
      return NextResponse.json(
        { error: "Akun belum terhubung ke couple. Coba muat ulang." },
        { status: 409 },
      );
    }

    // SEC: photoIds come from the client. Only link media owned by this
    // couple (legacy coupleId-null rows are shared) — never a foreign row.
    if (photoIds?.length) {
      const uniquePhotoIds = [...new Set(photoIds)];
      const owned = await prisma.photo.findMany({
        where: {
          id: { in: uniquePhotoIds },
          ...(coupleId
            ? { OR: [{ coupleId }, { coupleId: null, uploadedById: session.user.id }] }
            : { coupleId: null, uploadedById: session.user.id }),
        },
        select: { id: true },
      });
      if (owned.length !== uniquePhotoIds.length) {
        return NextResponse.json({ error: "Foto tidak ditemukan" }, { status: 400 });
      }
    }

    // per-item isolation — one bad upload must not 500 the whole milestone
    const createdPhotos: Array<{ id: string; crop?: { x: number; y: number; w: number; h: number } | null }> = [];
    const failedPhotos: { publicId: string; error: string }[] = [];
    if (photoUploads?.length) {
      const settled = await Promise.allSettled(
        photoUploads.map(async (upload) => {
          // SEC: same end-to-end byte trust as /api/photos — confirm the
          // stored asset before persisting, never attach foreign URLs.
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

    const milestone = await prisma.milestone.create({
      data: {
        ...milestoneData,
        date,
        createdById: session.user.id,
        coupleId,
        photos: allPhotoIds.length
          ? {
              // crop rides the link row — uploads carry their own crop, gallery links carry photoCrops.
              create: allPhotoIds.map((photoId) => ({
                photoId,
                crop: uploadCropById.get(photoId) ?? photoCrops?.[photoId] ?? undefined,
              })),
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
            crop: true,
            photo: {
              select: { id: true, url: true, thumbnailUrl: true, caption: true },
            },
          },
        },
      },
    });

    const userMap = await batchLoadUsers([milestone.createdById]);
    const data = { ...milestone, createdBy: toPublicUser(userMap.get(milestone.createdById)) };

    await invalidateCache("milestones:*");
    await invalidateCache("dashboard:*");
    await invalidateCache("home:*");

    if (coupleId) {
      triggerCoupleEvent(coupleId, 'TIMELINE');
    }

    if (failedPhotos.length > 0) {
      return NextResponse.json({ data, failedPhotos }, { status: 207 });
    }
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Error creating milestone:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
