import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createPhotoSchema } from "@/lib/validations/photo";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { getCached, setCached, invalidateCache, cacheKey } from "@/lib/redis";
import { jakartaYearStart } from "@/lib/date";
import { generateId, encodeCompositeCursor, decodeCompositeCursor } from "@/lib/utils";
import { isAllowedCloudinaryUrl, publicIdBelongsToUser } from "@/lib/upload-policy";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";

export const runtime = "nodejs";

const CACHE_TTL = 60;

function buildPhotoSelect() {
  return `"id", "url", "publicId", "thumbnailUrl", "caption", "takenAt", "width", "height", "isVideo", "isFavorite", "albumId", "uploadedById", "createdAt", "updatedAt"`;
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    const isAuthed = !!session?.user;

    const { searchParams } = new URL(request.url);
    const albumId = searchParams.get("albumId");
    const year = searchParams.get("year");
    const isFavorite = searchParams.get("isFavorite");
    const mediaType = searchParams.get("mediaType");
    const sort = searchParams.get("sort");
    const cursor = searchParams.get("cursor");
    const limit = parseInt(searchParams.get("limit") || "50");

    const scope = isAuthed ? "auth" : "public";
    const cacheK = cacheKey("photos", "list", scope, albumId ?? "", year ?? "", isFavorite ?? "", mediaType ?? "", sort ?? "", cursor ?? "0", String(limit));
    const cached = await getCached<unknown>(cacheK);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": isAuthed ? "private, s-maxage=60" : "public, s-maxage=60, stale-while-revalidate=300" },
      });
    }

    const conditions: string[] = ['"isMilestoneOnly" = false'];
    const sqlParams: unknown[] = [];

    if (!isAuthed) {
      conditions.push(`"albumId" IN (SELECT "id" FROM "Album" WHERE "isPublic" = true)`);
    }

    if (albumId) {
      conditions.push(`"albumId" = $${sqlParams.length + 1}`);
      sqlParams.push(albumId);
    }

    if (isFavorite === "true") {
      conditions.push(`"isFavorite" = true`);
    }

    if (year) {
      const yearNum = parseInt(year);
      const startDate = jakartaYearStart(yearNum);
      const endDate = jakartaYearStart(yearNum + 1);
      const startIdx = sqlParams.length + 1;
      conditions.push(`"takenAt" >= $${startIdx} AND "takenAt" < $${startIdx + 1}`);
      sqlParams.push(startDate, endDate);
    }

    if (mediaType === "video") {
      conditions.push(`"isVideo" = true`);
    } else if (mediaType === "foto") {
      conditions.push(`"isVideo" = false`);
    }

    const isOldest = sort === "oldest";
    const orderDir = isOldest ? "ASC" : "DESC";
    const cmpOp = isOldest ? ">" : "<";

    // Composite cursor: (createdAt, id) matching ORDER BY "createdAt", "id"
    if (cursor) {
      const decoded = decodeCompositeCursor(cursor);
      if (decoded) {
        const caIdx = sqlParams.length + 1;
        const idIdx = sqlParams.length + 2;
        conditions.push(
          `("createdAt", "id") ${cmpOp} ($${caIdx}::timestamptz, $${idIdx})`,
        );
        sqlParams.push(new Date(decoded.createdAt), decoded.id);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const selectCols = buildPhotoSelect();
    const limitParamIdx = sqlParams.length + 1;

    const query = `SELECT ${selectCols} FROM "Photo" ${whereClause} ORDER BY "createdAt" ${orderDir}, "id" ${orderDir} LIMIT $${limitParamIdx}`;
    sqlParams.push(limit + 1);

    const photos = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(query, ...sqlParams);

    const hasMore = photos.length > limit;
    const data = hasMore ? photos.slice(0, limit) : photos;
    const last = data[data.length - 1];
    const nextCursor = hasMore && last
      ? encodeCompositeCursor(new Date(last.createdAt as string), last.id as string)
      : null;

    // total count from cache key hash or compute
    const countQuery = `SELECT COUNT(*)::int as cnt FROM "Photo" ${whereClause}`;
    const countResult = await prisma.$queryRawUnsafe<{ cnt: number }[]>(countQuery, ...sqlParams.slice(0, sqlParams.length - 1));
    const total = countResult[0]?.cnt ?? data.length;

    const fotoQuery = `SELECT COUNT(*)::int as cnt FROM "Photo" ${whereClause}${whereClause ? " AND" : "WHERE"} "isVideo" = false`;
    const fotoResult = await prisma.$queryRawUnsafe<{ cnt: number }[]>(fotoQuery, ...sqlParams.slice(0, sqlParams.length - 1));
    const fotoTotal = fotoResult[0]?.cnt ?? 0;

    const videoQuery = `SELECT COUNT(*)::int as cnt FROM "Photo" ${whereClause}${whereClause ? " AND" : "WHERE"} "isVideo" = true`;
    const videoResult = await prisma.$queryRawUnsafe<{ cnt: number }[]>(videoQuery, ...sqlParams.slice(0, sqlParams.length - 1));
    const videoTotal = videoResult[0]?.cnt ?? 0;

    const response = { data, nextCursor, hasMore, total, fotoTotal, videoTotal };

    await setCached(cacheK, response, CACHE_TTL);

    return NextResponse.json(response, {
      headers: { "Cache-Control": isAuthed ? "private, s-maxage=60" : "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("Error fetching photos:", error);
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
    const parsed = createPhotoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 },
      );
    }

    const { url, publicId, thumbnailUrl, caption, takenAt, width, height, isVideo, albumId } = parsed.data;
    if (!isAllowedCloudinaryUrl(url) || !publicIdBelongsToUser(publicId, session.user.id)) {
      return NextResponse.json({ error: "Invalid uploaded media" }, { status: 400 });
    }

    if (thumbnailUrl && !isAllowedCloudinaryUrl(thumbnailUrl)) {
      return NextResponse.json({ error: "Invalid thumbnail URL" }, { status: 400 });
    }

    if (isVideo && !url.includes("/video/upload/")) {
      return NextResponse.json({ error: "Invalid video media URL" }, { status: 400 });
    }

    const selectCols = buildPhotoSelect();
    const now = new Date();
    const result = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `INSERT INTO "Photo" ("id", "url", "publicId", "thumbnailUrl", "caption", "takenAt", "width", "height", "isVideo", "albumId", "uploadedById", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING ${selectCols}`,
      generateId(),
      url,
      publicId,
      thumbnailUrl ?? null,
      caption ?? null,
      takenAt ? new Date(takenAt) : null,
      width ?? null,
      height ?? null,
      isVideo ?? false,
      albumId ?? null,
      session.user.id,
      now,
      now,
    );

    await Promise.all([
      invalidateCache("photos:*"),
      invalidateCache("albums:*"),
      invalidateCache("dashboard:*"),
    ]);

    const coupleId = await getUserCoupleId(session.user.id);
    if (coupleId) {
      triggerCoupleEvent(coupleId, 'GALLERY');
    }

    return NextResponse.json({ data: result[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating photo:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
