import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getCached, setCached, invalidateCache, cacheKey } from "@/lib/redis";
import { updateCoupleSchema } from "@/lib/validations/couple";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { parseJakartaDateOnly } from "@/lib/date";
import { deleteFromCloudinaryUrl } from "@/lib/cloudinary";

const CACHE_TTL = 300;

export async function GET() {
  try {
    const cached = await getCached<unknown>(cacheKey("couple", "config"));
    if (cached) {
      return NextResponse.json({ data: cached }, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      });
    }

    const config = await prisma.coupleConfig.findFirst({
      take: 1,
      select: {
        id: true,
        name1: true,
        name2: true,
        anniversaryDate: true,
        birthDate1: true,
        birthDate2: true,
        tagline: true,
        heroPhotoUrl: true,
        spotifyPlaylistUrl: true,
        backgroundMusicUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!config) {
      return NextResponse.json(
        { error: "Couple config not found" },
        { status: 404 },
      );
    }

    await setCached(cacheKey("couple", "config"), config, CACHE_TTL);

    return NextResponse.json({ data: config }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("Error fetching couple config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.write);
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

    const body = await request.json();
    const parsed = updateCoupleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 },
      );
    }

    const config = await prisma.coupleConfig.findFirst({
      take: 1,
      select: { id: true, heroPhotoUrl: true, backgroundMusicUrl: true },
    });

    if (!config) {
      return NextResponse.json(
        { error: "Couple config not found" },
        { status: 404 },
      );
    }

    let anniversaryDate: Date | undefined;
    if (parsed.data.anniversaryDate) {
      const d = parseJakartaDateOnly(parsed.data.anniversaryDate);
      if (!d) {
        return NextResponse.json({ error: "Tanggal anniversary tidak valid" }, { status: 400 });
      }
      anniversaryDate = d;
    }

    let birthDate1: Date | null | undefined;
    if (parsed.data.birthDate1 !== undefined) {
      if (parsed.data.birthDate1 === null) {
        birthDate1 = null;
      } else {
        const d = parseJakartaDateOnly(parsed.data.birthDate1);
        if (!d) {
          return NextResponse.json({ error: "Tanggal lahir 1 tidak valid" }, { status: 400 });
        }
        birthDate1 = d;
      }
    }

    let birthDate2: Date | null | undefined;
    if (parsed.data.birthDate2 !== undefined) {
      if (parsed.data.birthDate2 === null) {
        birthDate2 = null;
      } else {
        const d = parseJakartaDateOnly(parsed.data.birthDate2);
        if (!d) {
          return NextResponse.json({ error: "Tanggal lahir 2 tidak valid" }, { status: 400 });
        }
        birthDate2 = d;
      }
    }

    const updated = await prisma.coupleConfig.update({
      where: { id: config.id },
      data: {
        name1: parsed.data.name1 ?? undefined,
        name2: parsed.data.name2 ?? undefined,
        anniversaryDate,
        birthDate1,
        birthDate2,
        tagline: parsed.data.tagline ?? undefined,
        heroPhotoUrl: parsed.data.heroPhotoUrl ?? undefined,
        spotifyPlaylistUrl: parsed.data.spotifyPlaylistUrl ?? undefined,
        backgroundMusicUrl: parsed.data.backgroundMusicUrl ?? undefined,
      },
      select: {
        id: true,
        name1: true,
        name2: true,
        anniversaryDate: true,
        birthDate1: true,
        birthDate2: true,
        tagline: true,
        heroPhotoUrl: true,
        spotifyPlaylistUrl: true,
        backgroundMusicUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await invalidateCache("couple:*");

    // Clean up old Cloudinary files if URLs changed
    if (config.heroPhotoUrl && config.heroPhotoUrl !== updated.heroPhotoUrl) {
      await deleteFromCloudinaryUrl(config.heroPhotoUrl).catch(console.error);
    }
    if (config.backgroundMusicUrl && config.backgroundMusicUrl !== updated.backgroundMusicUrl) {
      await deleteFromCloudinaryUrl(config.backgroundMusicUrl).catch(console.error);
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error updating couple config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
