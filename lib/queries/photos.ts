import { prisma } from "@/lib/prisma";
import { getCached, setCached, cacheKey } from "@/lib/redis";
import { jakartaYearStart } from "@/lib/date";
import { encodeCompositeCursor, decodeCompositeCursor } from "@/lib/utils";

const CACHE_TTL = 60;

export type PhotoListParams = {
  albumId: string | null;
  year: string | null;
  isFavorite: string | null;
  mediaType: string | null;
  visibility: "public" | "private" | null;
  sort: string | null;
  cursor: string | null;
  limit: number;
};

export type PhotoListContext = {
  isAuthed: boolean;
  userId: string;
  coupleId: string | null;
};

export type PhotoListResponse = {
  data: Array<Record<string, unknown>>;
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
  fotoTotal: number;
  videoTotal: number;
};

export class PhotoFilterError extends Error {}

function buildPhotoSelect(alias = "") {
  const p = alias ? `${alias}.` : "";
  return `${p}"id", ${p}"url", ${p}"publicId", ${p}"thumbnailUrl", ${p}"caption", ${p}"width", ${p}"height", ${p}"isVideo", ${p}"isFavorite", ${p}"isPublic", ${p}"albumId", ${p}"uploadedById", ${p}"createdAt", ${p}"updatedAt", u."name" AS "uploadedByName", u."image" AS "uploadedByImage"`;
}

/**
 * Cursor-paginated photo list.
 * Single source for GET /api/photos and the dashboard gallery page's
 * server-side hydration — both must stay in lockstep.
 *
 * Visibility rules (do not weaken):
 * - anon OR unpaired: public photos in public-or-no album only
 * - visibility=private: couple rows + own legacy null-couple rows
 * - default authed: couple rows + own legacy null-couple rows
 * - visibility=public: same public rule as anon
 */
export async function listPhotos(
  params: PhotoListParams,
  ctx: PhotoListContext,
): Promise<PhotoListResponse> {
  const { isAuthed, userId, coupleId } = ctx;
  const { albumId, year, isFavorite, mediaType, visibility, sort, cursor, limit } = params;

  const scope = isAuthed ? "auth" : "public";
  const cacheK = cacheKey("photos", "list", scope, coupleId ?? "nocouple", userId, albumId ?? "", year ?? "", isFavorite ?? "", mediaType ?? "", visibility ?? "", sort ?? "", cursor ?? "0", String(limit));
  const cached = await getCached<PhotoListResponse>(cacheK);
  if (cached) return cached;

  if (albumId && coupleId && visibility !== "public") {
    // SEC: unvalidated ?albumId= must not enumerate another couple's album.
    const albumOwner = await prisma.album.findUnique({
      where: { id: albumId },
      select: { id: true, coupleId: true },
    });
    if (!albumOwner || (albumOwner.coupleId !== null && albumOwner.coupleId !== coupleId)) {
      return { data: [], nextCursor: null, hasMore: false, total: 0, fotoTotal: 0, videoTotal: 0 };
    }
  }

  const conditions: string[] = ['"isMilestoneOnly" = false'];
  const sqlParams: unknown[] = [];

  // one public rule for anon AND authed public filter — photo must be
  // public AND (unfiled OR in a public album). Private context skips the gate.
  // SEC: authed non-public views are couple-scoped; legacy null-couple rows
  // stay visible only to their uploader (matches GET /api/photos/[id]).
  if (!isAuthed || !coupleId) {
    conditions.push(`"isPublic" = true`);
    conditions.push(
      `("albumId" IS NULL OR "albumId" IN (SELECT "id" FROM "Album" WHERE "isPublic" = true))`,
    );
  } else if (visibility === "private") {
    conditions.push(`"isPublic" = false`);
    conditions.push(`("coupleId" = $${sqlParams.length + 1} OR ("coupleId" IS NULL AND "uploadedById" = $${sqlParams.length + 2}))`);
    sqlParams.push(coupleId, userId);
  } else if (visibility !== "public") {
    conditions.push(`("coupleId" = $${sqlParams.length + 1} OR ("coupleId" IS NULL AND "uploadedById" = $${sqlParams.length + 2}))`);
    sqlParams.push(coupleId, userId);
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
      throw new PhotoFilterError("Filter tahun tidak valid");
    }
    const startDate = jakartaYearStart(yearNum);
    const endDate = jakartaYearStart(yearNum + 1);
    const startIdx = sqlParams.length + 1;
    conditions.push(`"createdAt" >= $${startIdx} AND "createdAt" < $${startIdx + 1}`);
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

  const response: PhotoListResponse = { data, nextCursor, hasMore, total, fotoTotal, videoTotal };

  await setCached(cacheK, response, CACHE_TTL);

  return response;
}
