import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createAlbumSchema } from "@/lib/validations/photo";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { getCached, setCached, invalidateCache, cacheKey } from "@/lib/redis";

const CACHE_TTL = 120;

export async function GET(request: Request) {
  try {
    const session = await auth();
    const isAuthed = !!session?.user;

    const cacheK = cacheKey("albums", "list", isAuthed ? "all" : "public");
    const cached = await getCached<unknown>(cacheK);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": isAuthed ? "private, s-maxage=120" : "public, s-maxage=120, stale-while-revalidate=600" },
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
      headers: { "Cache-Control": isAuthed ? "private, s-maxage=120" : "public, s-maxage=120, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("Error fetching albums:", error);
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

    const body = await request.json();
    const parsed = createAlbumSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 },
      );
    }

    const album = await prisma.album.create({
      data: parsed.data,
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

    return NextResponse.json({ data: album }, { status: 201 });
  } catch (error) {
    console.error("Error creating album:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
