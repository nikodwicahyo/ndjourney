import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createAlbumSchema } from "@/lib/validations/photo";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { getCached, setCached, invalidateCache, cacheKey } from "@/lib/redis";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";

const CACHE_TTL = 120;

export async function GET(request: Request) {
  try {
    const session = await auth();
    const isAuthed = !!session?.user;

    const cacheK = cacheKey("albums", "list", isAuthed ? "all" : "public");
    const cached = await getCached<unknown>(cacheK);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "private, no-cache" },
      });
    }

    type AlbumRow = {
      id: string;
      name: string;
      description: string | null;
      coverPhotoUrl: string | null;
      isPublic: boolean;
      createdAt: Date;
      updatedAt: Date;
      photoCount: bigint;
    };

    const rows = !isAuthed
      ? await prisma.$queryRaw<AlbumRow[]>`
          SELECT
            a.id, a.name, a.description, a."coverPhotoUrl", a."isPublic", a."createdAt", a."updatedAt",
            COUNT(p.id)::int AS "photoCount"
          FROM "Album" a
          LEFT JOIN "Photo" p ON p."albumId" = a.id
          WHERE a."isPublic" = true
          GROUP BY a.id
          ORDER BY a."createdAt" DESC
        `
      : await prisma.$queryRaw<AlbumRow[]>`
          SELECT
            a.id, a.name, a.description, a."coverPhotoUrl", a."isPublic", a."createdAt", a."updatedAt",
            COUNT(p.id)::int AS "photoCount"
          FROM "Album" a
          LEFT JOIN "Photo" p ON p."albumId" = a.id
          GROUP BY a.id
          ORDER BY a."createdAt" DESC
        `;

    const data = rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      coverPhotoUrl: r.coverPhotoUrl,
      isPublic: r.isPublic,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      _count: { photos: Number(r.photoCount) },
    }));

    const response = { data };

    await setCached(cacheK, response, CACHE_TTL);

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (error) {
    console.error("Error fetching albums:", error);
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

    const body = await request.json().catch(() => null);
    if (body == null || typeof body !== "object") return NextResponse.json({ error: "Body JSON tidak valid", code: "BAD_JSON" }, { status: 400 });
    // ponytail: trim here so "   " fails Zod min(1) instead of creating a blank album.
    const normalized = {
      ...body,
      name: typeof body.name === "string" ? body.name.trim() : body.name,
      description:
        typeof body.description === "string"
          ? body.description.trim() || undefined
          : body.description,
    };
    const parsed = createAlbumSchema.safeParse(normalized);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data album tidak valid", code: "VALIDATION" },
        { status: 400 },
      );
    }

    const userId = rateCheck.session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    const creatorCoupleId = await getUserCoupleId(userId);

    const album = await prisma.album.create({
      data: { ...parsed.data, coupleId: creatorCoupleId },
      select: {
        id: true,
        name: true,
        description: true,
        coverPhotoUrl: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await invalidateCache("albums:*");

    if (creatorCoupleId) {
      triggerCoupleEvent(creatorCoupleId, 'GALLERY');
    }

    return NextResponse.json({ data: album }, { status: 201 });
  } catch (error) {
    console.error("Error creating album:", error);
    const code = (error as { code?: string })?.code;
    // ponytail: map known Prisma failures so client can retry/redirect correctly.
    if (code === "P2002") {
      return NextResponse.json(
        { error: "Album dengan nama tersebut sudah ada.", code },
        { status: 409 },
      );
    }
    if (code === "P2025") {
      return NextResponse.json(
        { error: "Data terkait tidak ditemukan.", code },
        { status: 404 },
      );
    }
    if (code && /^P1(001|002|008|017|019|020)$/.test(code)) {
      return NextResponse.json(
        { error: "Database tidak dapat dijangkau. Coba lagi nanti.", code },
        { status: 503 },
      );
    }
    // ponytail: P2022 = schema drift (e.g. migration not deployed) — 503, never generic 500.
    if (code === "P2022") {
      return NextResponse.json(
        { error: "Layanan sedang penyesuaian database. Coba lagi nanti.", code },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti.", code: "INTERNAL" },
      { status: 500 },
    );
  }
}
