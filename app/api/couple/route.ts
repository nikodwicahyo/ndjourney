import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCached, setCached, invalidateCache, cacheKey } from "@/lib/redis";
import { updateCoupleSchema } from "@/lib/validations/couple";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { parseJakartaDateOnly } from "@/lib/date";
import { deleteFromCloudinaryUrl } from "@/lib/cloudinary";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";

const CACHE_TTL = 300;

export async function GET() {
  try {
    const cached = await getCached<unknown>(cacheKey("couple", "config"));
    if (cached) {
      return NextResponse.json({ data: cached }, {
        headers: { "Cache-Control": "private, no-cache" },
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
        heroCrop: true,
        spotifyPlaylistUrl: true,
        backgroundMusicUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!config) {
      return NextResponse.json(
        { error: "Konfigurasi pasangan tidak ditemukan" },
        { status: 404 },
      );
    }

    await setCached(cacheKey("couple", "config"), config, CACHE_TTL);

    return NextResponse.json({ data: config }, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (error) {
    console.error("Error fetching couple config:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
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

    // singleton config is writable by couple members only.
    const editorCoupleId = await getUserCoupleId(rateCheck.session.user.id);
    if (!editorCoupleId) {
      return NextResponse.json({ error: "Pasangan belum ditemukan" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (body == null) return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    const parsed = updateCoupleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data pasangan tidak valid" },
        { status: 400 },
      );
    }

    const config = await prisma.coupleConfig.findFirst({
      take: 1,
      select: { id: true, heroPhotoUrl: true, backgroundMusicUrl: true },
    });

    if (!config) {
      return NextResponse.json(
        { error: "Konfigurasi pasangan tidak ditemukan" },
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

    // ?? would swallow explicit null (clear) into undefined (keep) —
    // assign only when the key was actually sent.
    const d = parsed.data;
    const updated = await prisma.coupleConfig.update({
      where: { id: config.id },
      data: {
        ...(d.name1 !== undefined ? { name1: d.name1 } : {}),
        ...(d.name2 !== undefined ? { name2: d.name2 } : {}),
        ...(anniversaryDate !== undefined ? { anniversaryDate } : {}),
        ...(birthDate1 !== undefined ? { birthDate1 } : {}),
        ...(birthDate2 !== undefined ? { birthDate2 } : {}),
        ...(d.tagline !== undefined ? { tagline: d.tagline } : {}),
        ...(d.heroPhotoUrl !== undefined ? { heroPhotoUrl: d.heroPhotoUrl } : {}),
        // crop without photo is meaningless — clearing the photo clears the crop.
        // DbNull = SQL NULL (plain null would store JSON null for Json fields).
        // Explicit null (Pakai Asli) clears; undefined leaves unchanged.
        ...(d.heroCrop !== undefined || d.heroPhotoUrl === null
          ? {
              heroCrop:
                d.heroPhotoUrl === null || d.heroCrop === null
                  ? Prisma.DbNull
                  : d.heroCrop,
            }
          : {}),
        ...(d.spotifyPlaylistUrl !== undefined ? { spotifyPlaylistUrl: d.spotifyPlaylistUrl } : {}),
        ...(d.backgroundMusicUrl !== undefined ? { backgroundMusicUrl: d.backgroundMusicUrl } : {}),
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
        heroCrop: true,
        spotifyPlaylistUrl: true,
        backgroundMusicUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await invalidateCache("couple:*");
    // Server-rendered surfaces (homepage hero/metadata, notes subtitle,
    // login tagline) read the same row — bust Next cache immediately so a
    // settings save is visible end-to-end instead of after the 300s TTL.
    // Best-effort: throws outside the Next runtime (unit tests), where
    // redis invalidation is already the source of truth.
    try {
      revalidatePath("/", "page");
      revalidatePath("/notes", "page");
      revalidatePath("/login", "page");
    } catch {
      // ponytail: no Next static-generation store here (tests/edge) — skip.
    }

    // Clean up old Cloudinary files if URLs changed — but never delete a hero
    // URL that is still referenced by a gallery photo (gallery-picked heroes
    // share the original file; deleting it would destroy gallery data).
    if (config.heroPhotoUrl && config.heroPhotoUrl !== updated.heroPhotoUrl) {
      const stillReferenced = await prisma.photo.findFirst({
        where: { url: config.heroPhotoUrl },
        select: { id: true },
      });
      if (!stillReferenced) {
        await deleteFromCloudinaryUrl(config.heroPhotoUrl).catch(console.error);
      }
    }
    if (config.backgroundMusicUrl && config.backgroundMusicUrl !== updated.backgroundMusicUrl) {
      await deleteFromCloudinaryUrl(config.backgroundMusicUrl).catch(console.error);
    }

    const coupleId = await getUserCoupleId(rateCheck.session.user.id);
    if (coupleId) {
      triggerCoupleEvent(coupleId, 'DASHBOARD');
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error updating couple config:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
