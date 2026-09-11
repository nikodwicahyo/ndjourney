import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import type { Photo } from "@/types";
import { invalidateCache } from "@/lib/redis";
import { triggerCoupleEvent } from "@/lib/pusher-server";
import { isAllowedCloudinaryUrl, publicIdBelongsToUser } from "@/lib/upload-policy";

export const runtime = "nodejs";

const bulkUploadSchema = z.object({
  photos: z
    .array(
      z.object({
        url: z.string().url(),
        publicId: z.string().min(1),
        thumbnailUrl: z.string().url().optional(),
        caption: z.string().max(500).optional(),
        takenAt: z.string().datetime().optional(),
        width: z.number().int().nonnegative().optional().default(0),
        height: z.number().int().nonnegative().optional().default(0),
        fileSize: z.number().int().nonnegative().optional().default(0),
        isVideo: z.boolean().default(false),
        isPublic: z.boolean().optional(),
        albumId: z.string().cuid().optional(),
      }),
    )
    .min(1)
    .max(50),
});

export async function POST(request: Request) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.upload);
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

    const session = rateCheck.session;

    const body = await request.json();
    const parsed = bulkUploadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 },
      );
    }

    // Get user's coupleId if they have one
    const coupleMember = await prisma.coupleMember.findFirst({
      where: { userId: session.user.id },
      select: { coupleId: true },
    });
    const coupleId = coupleMember?.coupleId ?? null;

    const insertValues: string[] = [];
    const flatParams: unknown[] = [];
    let idx = 1;

    // ponytail: per-item isolation — one bad file must not fail the whole batch
    const failed: { publicId: string; error: string }[] = [];
    const valid: typeof parsed.data.photos = [];
    for (const p of parsed.data.photos) {
      if (!isAllowedCloudinaryUrl(p.url) || !publicIdBelongsToUser(p.publicId, session.user.id)) {
        failed.push({ publicId: p.publicId, error: `Invalid or unowned media: ${p.publicId}` });
        continue;
      }

      if (p.thumbnailUrl && !isAllowedCloudinaryUrl(p.thumbnailUrl)) {
        failed.push({ publicId: p.publicId, error: "Invalid thumbnail URL" });
        continue;
      }

      if (p.isVideo && !p.url.includes("/video/upload/")) {
        failed.push({ publicId: p.publicId, error: "Invalid video media URL" });
        continue;
      }
      valid.push(p);
    }

    if (valid.length === 0) {
      return NextResponse.json(
        { error: failed[0]?.error ?? "No valid media", failed },
        { status: 400 },
      );
    }

    for (const p of valid) {

      insertValues.push(
        `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`,
      );
      const now = new Date();
      flatParams.push(
        `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
        p.url,
        p.publicId,
        p.thumbnailUrl ?? null,
        p.caption ?? null,
        p.takenAt ? new Date(p.takenAt) : null,
        // ponytail: null sentinel like single POST (0 breaks SUM math)
        p.width || null,
        p.height || null,
        p.fileSize || null,
        p.isVideo,
        p.isPublic ?? true,
        p.albumId ?? null,
        session.user.id,
        coupleId,
        now,
        now,
      );
    }

    const query = `INSERT INTO "Photo" ("id", "url", "publicId", "thumbnailUrl", "caption", "takenAt", "width", "height", "fileSize", "isVideo", "isPublic", "albumId", "uploadedById", "coupleId", "createdAt", "updatedAt") VALUES ${insertValues.join(", ")} RETURNING *`;

    let photos: Photo[];
    try {
      photos = await prisma.$queryRawUnsafe<Photo[]>(query, ...flatParams);
    } catch {
      // ponytail: one bad row (e.g. stale albumId FK) must not kill the batch -> per-row fallback
      const settled = await Promise.allSettled(
        valid.map((p) =>
          prisma.photo.create({
            data: {
              url: p.url,
              publicId: p.publicId,
              thumbnailUrl: p.thumbnailUrl ?? null,
              caption: p.caption ?? null,
              takenAt: p.takenAt ? new Date(p.takenAt) : null,
              width: p.width || null,
              height: p.height || null,
              fileSize: p.fileSize || null,
              isVideo: p.isVideo,
              isPublic: p.isPublic ?? true,
              albumId: p.albumId ?? null,
              uploadedById: session.user.id,
              coupleId,
            },
          }),
        ),
      );
      photos = [];
      settled.forEach((r, i) => {
        if (r.status === "fulfilled") photos.push(r.value as Photo);
        else failed.push({ publicId: valid[i].publicId, error: r.reason instanceof Error ? r.reason.message : "Save failed" });
      });
      if (photos.length === 0) {
        return NextResponse.json({ error: "All saves failed", failed }, { status: 400 });
      }
    }

    await Promise.all([
      invalidateCache("photos:*"),
      invalidateCache("albums:*"),
      invalidateCache("dashboard:*"),
    ]);

    if (coupleId) {
      triggerCoupleEvent(coupleId, 'GALLERY');
    }

    if (failed.length > 0) {
      return NextResponse.json({ data: photos, failed }, { status: 207 });
    }
    return NextResponse.json({ data: photos }, { status: 201 });
  } catch (error) {
    console.error("Error bulk uploading photos:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
