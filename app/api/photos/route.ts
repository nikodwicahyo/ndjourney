import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createPhotoSchema } from "@/lib/validations/photo";
import { withRateLimit, withAnonymousRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { getCached, setCached, invalidateCache, cacheKey } from "@/lib/redis";
import { jakartaYearStart } from "@/lib/date";
import { encodeCompositeCursor, decodeCompositeCursor } from "@/lib/utils";
import { isAllowedCloudinaryUrl } from "@/lib/upload-policy";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";
import { UploadVerifyError, verifyUploadForSave } from "@/lib/upload-verify";

export const runtime = "nodejs";

const CACHE_TTL = 60;

function buildPhotoSelect(alias = "") {
  const p = alias ? `${alias}.` : "";
  return `${p}"id", ${p}"url", ${p}"publicId", ${p}"thumbnailUrl", ${p}"caption", ${p}"takenAt", ${p}"width", ${p}"height", ${p}"isVideo", ${p}"isFavorite", ${p}"isPublic", ${p}"albumId", ${p}"uploadedById", ${p}"createdAt", ${p}"updatedAt", u."name" AS "uploadedByName", u."image" AS "uploadedByImage"`;
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    const isAuthed = !!session?.user;

    // MR-07: data query + triple-COUNT subselects are scrapable anon —
    // throttle generously (gallery infinite-scroll stays usable).
    if (!isAuthed) {
      const rl = await withAnonymousRateLimit(request, { maxRequests: 300, windowSeconds: 3600, keyPrefix: "photos:list" });
      if (!rl.allowed) return rl.response;
    }

    const { searchParams } = new URL(request.url);
    const albumId = searchParams.get("albumId");
    const year = searchParams.get("year");
    const isFavorite = searchParams.get("isFavorite");
    const mediaType = searchParams.get("mediaType");
    const rawVisibility = searchParams.get("visibility");
    // legacy ?public=true / ?isPublic=true (old usePhotos) maps to public — resilient to cached clients.
    const legacyPublic = searchParams.get("public") === "true" || searchParams.get("isPublic") === "true";
    const visibility = rawVisibility === "public" || rawVisibility === "private"
      ? rawVisibility
      : legacyPublic ? "public" : null;
    const sort = searchParams.get("sort");
    const cursor = searchParams.get("cursor");
    const rawLimit = parseInt(searchParams.get("limit") || "30", 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 30;

    const scope = isAuthed ? "auth" : "public";
    const coupleId = session?.user ? await getUserCoupleId(session.user.id) : null;
    const cacheK = cacheKey("photos", "list", scope, coupleId ?? "nocouple", albumId ?? "", year ?? "", isFavorite ?? "", mediaType ?? "", visibility ?? "", sort ?? "", cursor ?? "0", String(limit));
    const cached = await getCached<unknown>(cacheK);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "private, no-cache" },
      });
    }

    if (albumId && coupleId && visibility !== "public") {
      // SEC: unvalidated ?albumId= must not enumerate another couple's album.
      const albumOwner = await prisma.album.findUnique({
        where: { id: albumId },
        select: { id: true, coupleId: true },
      });
      if (!albumOwner || (albumOwner.coupleId !== null && albumOwner.coupleId !== coupleId)) {
        return NextResponse.json({ data: [], nextCursor: null, hasMore: false, total: 0, fotoTotal: 0, videoTotal: 0 });
      }
    }

    const conditions: string[] = ['"isMilestoneOnly" = false'];
    const sqlParams: unknown[] = [];

    // one public rule for anon AND authed public filter — photo must be
    // public AND (unfiled OR in a public album). Private context skips the gate.
    // SEC: authed non-public views are couple-scoped (legacy null rows stay visible).
    const isPublicView = !isAuthed || visibility === "public";
    if (!isAuthed || !coupleId) {
      conditions.push(`"isPublic" = true`);
      conditions.push(
        `("albumId" IS NULL OR "albumId" IN (SELECT "id" FROM "Album" WHERE "isPublic" = true))`,
      );
    } else if (visibility === "private") {
      conditions.push(`"isPublic" = false`);
      conditions.push(`("coupleId" = $${sqlParams.length + 1} OR "coupleId" IS NULL)`);
      sqlParams.push(coupleId);
    } else if (visibility !== "public") {
      conditions.push(`("coupleId" = $${sqlParams.length + 1} OR "coupleId" IS NULL)`);
      sqlParams.push(coupleId);
    } else {
      conditions.push(`"isPublic" = true`);
      conditions.push(
        `("albumId" IS NULL OR "albumId" IN (SELECT "id" FROM "Album" WHERE "isPublic" = true))`,
      );
    }

    if (albumId) {
      conditions.push(`"albumId" = $${sqlParams.length + 1}`);
      sqlParams.push(albumId);
    }

    if (isFavorite === "true") {
      conditions.push(`"isFavorite" = true`);
    }

    if (year) {
      const yearNum = parseInt(year, 10);
      if (!Number.isFinite(yearNum) || yearNum < 1900 || yearNum > 3000) {
        return NextResponse.json({ error: "Filter tahun tidak valid" }, { status: 400 });
      }
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

    const baseWhereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Composite cursor: (createdAt, id) matching ORDER BY "createdAt", "id"
    const allParams = [...sqlParams];
    let cursorCondition = "";
    if (cursor) {
      const decoded = decodeCompositeCursor(cursor);
      if (decoded) {
        const caIdx = allParams.length + 1;
        const idIdx = allParams.length + 2;
        cursorCondition = ` AND (p."createdAt", p."id") ${cmpOp} ($${caIdx}::timestamptz, $${idIdx})`;
        allParams.push(new Date(decoded.createdAt), decoded.id);
      }
    }

    const selectCols = buildPhotoSelect("p");
    const limitParamIdx = allParams.length + 1;

    const query = `SELECT ${selectCols} FROM "Photo" p LEFT JOIN "User" u ON p."uploadedById" = u."id" ${baseWhereClause}${cursorCondition} ORDER BY p."createdAt" ${orderDir}, p."id" ${orderDir} LIMIT $${limitParamIdx}`;
    allParams.push(limit + 1);

    const photos = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(query, ...allParams);

    const hasMore = photos.length > limit;
    const data = hasMore ? photos.slice(0, limit) : photos;
    const last = data[data.length - 1];
    const nextCursor = hasMore && last
      ? encodeCompositeCursor(new Date(last.createdAt as string), last.id as string)
      : null;

    // 1 round-trip — counts as subselects (was 1 data + 3 sequential COUNTs).
    // NOTE: each WHERE copy needs its own $n numbering — reusing the same clause
    // 3x against one param array is 08P01 (only worked while zero params were bound).
    const shiftPlaceholders = (clause: string, offset: number) =>
      clause.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + offset}`);
    const nParams = sqlParams.length;
    const countQuery = `SELECT (SELECT COUNT(*)::int FROM "Photo" ${baseWhereClause}) AS total,
      (SELECT COUNT(*)::int FROM "Photo" ${shiftPlaceholders(baseWhereClause, nParams)}${baseWhereClause ? " AND" : "WHERE"} "isVideo" = false) AS "fotoTotal",
      (SELECT COUNT(*)::int FROM "Photo" ${shiftPlaceholders(baseWhereClause, 2 * nParams)}${baseWhereClause ? " AND" : "WHERE"} "isVideo" = true) AS "videoTotal"`;
    const countResult = await prisma.$queryRawUnsafe<{ total: number; fotoTotal: number; videoTotal: number }[]>(countQuery, ...sqlParams, ...sqlParams, ...sqlParams);
    const total = countResult[0]?.total ?? data.length;
    const fotoTotal = countResult[0]?.fotoTotal ?? 0;
    const videoTotal = countResult[0]?.videoTotal ?? 0;

    const response = { data, nextCursor, hasMore, total, fotoTotal, videoTotal };

    await setCached(cacheK, response, CACHE_TTL);

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (error) {
    console.error("Error fetching photos:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti.", code: "INTERNAL" },
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
    const parsed = createPhotoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data foto tidak valid" },
        { status: 400 },
      );
    }

    const { url, publicId, thumbnailUrl, caption, takenAt, width, height, isVideo, fileSize, albumId, isPublic } = parsed.data;
    // End-to-end byte trust: the sign endpoint only saw claims, so confirm
    // the stored asset (kind, format, bytes) before persisting metadata.
    try {
      await verifyUploadForSave({ url, publicId, userId: session.user.id, isVideo: isVideo ?? false });
    } catch (e) {
      if (e instanceof UploadVerifyError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }

    if (thumbnailUrl && !isAllowedCloudinaryUrl(thumbnailUrl)) {
      return NextResponse.json({ error: "URL thumbnail tidak valid" }, { status: 400 });
    }

    const coupleId = await getUserCoupleId(session.user.id);

    if (albumId) {
      const album = await prisma.album.findUnique({
        where: { id: albumId },
        select: { id: true, coupleId: true },
      });
      if (!album || (album.coupleId !== null && album.coupleId !== coupleId)) {
        return NextResponse.json({ error: "Album tidak ditemukan" }, { status: 400 });
      }
    }

    // prisma.create instead of raw INSERT (raw had 14 cols / 15 values, isPublic shifted into uploadedById -> every save 500d)
    const created = await prisma.photo.create({
      data: {
        url,
        publicId,
        thumbnailUrl: thumbnailUrl ?? null,
        caption: caption ?? null,
        takenAt: takenAt ? new Date(takenAt) : null,
        width: width ?? null,
        height: height ?? null,
        fileSize: fileSize ?? null,
        isVideo: isVideo ?? false,
        isPublic: isPublic ?? true,
        albumId: albumId ?? null,
        uploadedById: session.user.id,
        coupleId,
      },
    });

    await Promise.all([
      invalidateCache("photos:*"),
      invalidateCache("albums:*"),
      invalidateCache("dashboard:*"),
      invalidateCache("home:*"),
      invalidateCache("storage:*"),
    ]);

    if (coupleId) {
      triggerCoupleEvent(coupleId, 'GALLERY');
    }

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error("Error creating photo:", error);
    // stale albumId FK -> 400, not generic 500
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2003") {
      return NextResponse.json({ error: "Album tidak ditemukan", code: "P2003" }, { status: 400 });
    }
    const code = (error as { code?: string })?.code;
    // DB-unreachable / schema drift must read 503 (retryable), not 500 — same mapping as POST /api/albums.
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
