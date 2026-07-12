import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { generateId } from "@/lib/utils";
import type { Photo } from "@/types";

const bulkUploadSchema = z.object({
  photos: z
    .array(
      z.object({
        url: z.string().url(),
        publicId: z.string().min(1),
        thumbnailUrl: z.string().url().optional(),
        caption: z.string().max(500).optional(),
        takenAt: z.string().datetime().optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        fileSize: z.number().int().positive().optional(),
        isVideo: z.boolean().default(false),
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

    const insertValues: string[] = [];
    const flatParams: unknown[] = [];
    let idx = 1;

    for (const p of parsed.data.photos) {
      insertValues.push(
        `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`,
      );
      const now = new Date();
      flatParams.push(
        generateId(),
        p.url,
        p.publicId,
        p.thumbnailUrl ?? null,
        p.caption ?? null,
        p.takenAt ? new Date(p.takenAt) : null,
        p.width ?? null,
        p.height ?? null,
        p.fileSize ?? null,
        p.isVideo,
        p.albumId ?? null,
        session.user.id,
        now,
        now,
      );
    }

    const query = `INSERT INTO "Photo" ("id", "url", "publicId", "thumbnailUrl", "caption", "takenAt", "width", "height", "fileSize", "isVideo", "albumId", "uploadedById", "createdAt", "updatedAt") VALUES ${insertValues.join(", ")} RETURNING *`;

    const photos = await prisma.$queryRawUnsafe<Photo[]>(query, ...flatParams);

    return NextResponse.json({ data: photos }, { status: 201 });
  } catch (error) {
    console.error("Error bulk uploading photos:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}