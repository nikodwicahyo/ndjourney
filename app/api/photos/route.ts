import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createPhotoSchema } from "@/lib/validations/photo";
import { withRateLimit, withAnonymousRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { invalidateCache } from "@/lib/redis";
import { listPhotos, PhotoFilterError } from "@/lib/queries/photos";
import { PHOTO_PAGE_SIZE } from "@/lib/utils";
import { isAllowedCloudinaryUrl } from "@/lib/upload-policy";
import { getUserCoupleId } from "@/lib/couple";
import { canManageCoupleRow } from "@/lib/couple-ownership";
import { triggerCoupleEvent } from "@/lib/pusher-server";
import { UploadVerifyError, verifyUploadForSave } from "@/lib/upload-verify";

export const runtime = "nodejs";

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
    const rawLimit = parseInt(searchParams.get("limit") || String(PHOTO_PAGE_SIZE), 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : PHOTO_PAGE_SIZE;

    // Legacy null-couple rows are uploader-scoped, so the result is per-user.
    const userId = session?.user?.id ?? "anon";
    const coupleId = session?.user ? await getUserCoupleId(session.user.id) : null;

    let response;
    try {
      response = await listPhotos(
        { albumId, year, isFavorite, mediaType, visibility, sort, cursor, limit },
        { isAuthed, userId, coupleId },
      );
    } catch (e) {
      if (e instanceof PhotoFilterError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

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

    const { url, publicId, thumbnailUrl, caption, width, height, isVideo, fileSize, albumId, isPublic } = parsed.data;
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
    // Never persist a row with no tenant (see the wish POST guard).
    if (!coupleId) {
      return NextResponse.json({ error: "Akun belum terhubung ke couple. Coba muat ulang." }, { status: 409 });
    }

    if (albumId) {
      const album = await prisma.album.findUnique({
        where: { id: albumId },
        select: { id: true, coupleId: true, createdById: true },
      });
      if (!album || !canManageCoupleRow(album, coupleId, session.user.id)) {
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
