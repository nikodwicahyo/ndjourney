import type { Metadata } from "next";
import { getImageProps } from "next/image";
import { preload } from "react-dom";
import { prisma } from "@/lib/prisma";
import { getCached, setCached, cacheKey } from "@/lib/redis";
import { ensureLoveMeterTargets } from "@/lib/love-meter";
import { parseCropRect } from "@/lib/image-crop";
import { getOptimizedImageUrl } from "@/lib/cloudinary-urls";
import { isVideoUrl } from "@/lib/utils";
import { APP_NAME, resolveTagline } from "@/lib/couple-display";
import HomeContent from "@/components/home/HomeContent";
import PageTransition from "@/components/PageTransition";

// Prerendered shell, refreshed in the background. Public content is not
// per-user, so this keeps TTFB off the database path for real visitors.
export const revalidate = 60;
// Explicit: the home page is cookie-free public content. Prerendering keeps
// TTFB off the database and puts the metadata (title/description) in <head>
// instead of streaming it into <body>.
export const dynamic = "force-static";

// The hero photo is the LCP element. Without an explicit preload the browser
// only discovers it after the (long) RSC payload has been parsed, which cost
// ~1.6 s of LCP on a throttled phone. Preloading the exact srcset next/image
// renders keeps the fetch in the critical path from the very first byte.
function preloadHeroImage(photoUrl: string | null | undefined) {
  if (!photoUrl || isVideoUrl(photoUrl)) return;

  const { props } = getImageProps({
    src: getOptimizedImageUrl(photoUrl, 1600),
    alt: "",
    fill: true,
    sizes: "100vw",
  });

  preload(props.src, {
    as: "image",
    imageSrcSet: props.srcSet,
    imageSizes: props.sizes,
    fetchPriority: "high",
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await getCoupleConfig();
  const tagline = (config as Record<string, unknown> | null)?.tagline as string | null | undefined;
  const resolved = resolveTagline(tagline);
  return {
    // absolute: the layout template already appends " - NDjourney".
    title: { absolute: `${APP_NAME} - ${resolved}` },
    description: resolved,
  };
}

async function getCoupleConfig() {
  try {
    const cached = await getCached<Record<string, unknown>>(cacheKey("couple", "config"));
    if (cached) return cached;

    const config = await prisma.coupleConfig.findFirst({ take: 1 });
    if (config) {
      await setCached(cacheKey("couple", "config"), config, 300);
    }
    return config;
  } catch {
    return null;
  }
}

async function getGallerySummary() {
  try {
    const cached = await getCached<{
      photoCount: number;
      videoCount: number;
      latestPhotos: Array<{ id: string; url: string; caption: string | null; createdAt: string; isVideo: boolean; isPublic: boolean }>;
    } | null>(cacheKey("home", "gallery"));
    if (cached) return cached;

    const [countResult, randomPhotos] = await Promise.all([
      prisma.$queryRaw<Array<{ photoCount: bigint; videoCount: bigint }>>`
        SELECT
          (SELECT COUNT(*) FROM "Photo" WHERE "isMilestoneOnly" = false AND "isPublic" = true AND ("albumId" IS NULL OR "albumId" IN (SELECT "id" FROM "Album" WHERE "isPublic" = true)))::int AS "photoCount",
          (SELECT COUNT(*) FROM "Photo" WHERE "isVideo" = true AND "isMilestoneOnly" = false AND "isPublic" = true AND ("albumId" IS NULL OR "albumId" IN (SELECT "id" FROM "Album" WHERE "isPublic" = true)))::int AS "videoCount"
      `,
      // Random public sample across the whole timeline (dates included) — the
      // slideshow walks this order once, then reshuffles on every loop.
      prisma.$queryRaw<Array<{
        id: string;
        url: string;
        caption: string | null;
        createdAt: Date | string;
        isVideo: boolean;
        isPublic: boolean;
      }>>`
        SELECT "id", "url", "caption", "createdAt", "isVideo", "isPublic"
        FROM "Photo"
        WHERE "isMilestoneOnly" = false AND "isPublic" = true
          AND ("albumId" IS NULL OR "albumId" IN (SELECT "id" FROM "Album" WHERE "isPublic" = true))
        ORDER BY RANDOM()
        LIMIT 50
      `,
    ]);

    const row = countResult[0];
    const result = {
      photoCount: Number(row?.photoCount ?? 0),
      videoCount: Number(row?.videoCount ?? 0),
      // Key kept as `latestPhotos` for cache-shape compatibility; the rows are
      // a random sample now, not the newest ones.
      latestPhotos: randomPhotos.map((p) => ({
        ...p,
        createdAt: new Date(p.createdAt).toISOString(),
      })),
    };

    await setCached(cacheKey("home", "gallery"), result, 300);
    return result;
  } catch {
    return { photoCount: 0, videoCount: 0, latestPhotos: [] };
  }
}

async function getTimelineSummary() {
  try {
    const cached = await getCached<{
      milestoneCount: number;
      latestMilestones: Array<{ id: string; title: string; icon: string | null; color: string | null; date: Date }>;
    } | null>(cacheKey("home", "timeline"));
    if (cached) return cached;

    const [countResult, milestones] = await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::int AS "count" FROM "Milestone" WHERE "isPublic" = true
      `,
      prisma.milestone.findMany({
        where: { isPublic: true },
        orderBy: { date: "desc" },
        take: 2,
        select: { id: true, title: true, icon: true, color: true, date: true },
      }),
    ]);

    const result = {
      milestoneCount: Number(countResult[0]?.count ?? 0),
      latestMilestones: milestones,
    };

    await setCached(cacheKey("home", "timeline"), result, 300);
    return result;
  } catch {
    return { milestoneCount: 0, latestMilestones: [] };
  }
}

async function getNotesSummary() {
  try {
    const cached = await getCached<{
      noteCount: number;
      latestNote: { content: string; authorName: string; authorImage: string | null } | null;
    } | null>(cacheKey("home", "notes"));
    if (cached) return cached;

    const [countResult, notes] = await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::int AS "count" FROM "DailyNote"
      `,
      prisma.dailyNote.findMany({
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, author: { select: { name: true, image: true } } },
      }),
    ]);

    const result = {
      noteCount: Number(countResult[0]?.count ?? 0),
      latestNote: notes[0]
        ? { content: notes[0].content, authorName: notes[0].author.name ?? "Pasangan", authorImage: notes[0].author.image ?? null }
        : null,
    };

    await setCached(cacheKey("home", "notes"), result, 300);
    return result;
  } catch {
    return { noteCount: 0, latestNote: null };
  }
}

async function getGamesSummary() {
  try {
    const cached = await getCached<{
      questionCount: number;
      totalGamesPlayed: number;
    } | null>(cacheKey("home", "games"));
    if (cached) return cached;

    const result = await prisma.$queryRaw<Array<{ questionCount: bigint; totalGamesPlayed: bigint }>>`
      SELECT
        (SELECT COUNT(*) FROM "GameQuestion")::int AS "questionCount",
        (SELECT COUNT(*) FROM "GameScore")::int AS "totalGamesPlayed"
    `;

    const row = result[0];
    const data = {
      questionCount: Number(row?.questionCount ?? 0),
      totalGamesPlayed: Number(row?.totalGamesPlayed ?? 0),
    };

    await setCached(cacheKey("home", "games"), data, 300);
    return data;
  } catch {
    return { questionCount: 0, totalGamesPlayed: 0 };
  }
}

async function getWishlistSummary() {
  try {
    const cached = await getCached<{
      total: number;
      done: number;
    } | null>(cacheKey("home", "wishlist"));
    if (cached) return cached;

    const result = await prisma.$queryRaw<Array<{ total: bigint; done: bigint }>>`
      SELECT
        (SELECT COUNT(*) FROM "WishItem")::int AS "total",
        (SELECT COUNT(*) FROM "WishItem" WHERE "isDone" = true)::int AS "done"
    `;

    const row = result[0];
    const data = {
      total: Number(row?.total ?? 0),
      done: Number(row?.done ?? 0),
    };

    await setCached(cacheKey("home", "wishlist"), data, 300);
    return data;
  } catch {
    return { total: 0, done: 0 };
  }
}

async function getLettersSummary() {
  try {
    const cached = await getCached<{ totalCount: number } | null>(cacheKey("home", "letters"));
    if (cached) return cached;

    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::int AS "count" FROM "Letter"
    `;

    const data = { totalCount: Number(result[0]?.count ?? 0) };

    await setCached(cacheKey("home", "letters"), data, 300);
    return data;
  } catch {
    return { totalCount: 0 };
  }
}

export default async function HomePage() {
  const [
    config,
    gallery,
    timeline,
    notes,
    games,
    wishlist,
    letters,
  ] = await Promise.all([
    getCoupleConfig(),
    getGallerySummary(),
    getTimelineSummary(),
    getNotesSummary(),
    getGamesSummary(),
    getWishlistSummary(),
    getLettersSummary(),
  ]);

  const loveMeterTargets = await ensureLoveMeterTargets({
    milestoneCount: timeline.milestoneCount,
    noteCount: notes.noteCount,
    letterCount: letters.totalCount,
    photoCount: gallery.photoCount,
  });

  preloadHeroImage((config as Record<string, unknown> | null)?.heroPhotoUrl as string | null | undefined);

  return (
    <PageTransition>
      <HomeContent
        coupleConfig={
          config
            ? {
                name1: (config as Record<string, unknown>).name1 as string,
                name2: (config as Record<string, unknown>).name2 as string,
                tagline: (config as Record<string, unknown>).tagline as string | null,
                heroPhotoUrl: (config as Record<string, unknown>).heroPhotoUrl as string | null,
                heroCrop: parseCropRect((config as Record<string, unknown>).heroCrop),
                anniversaryDate: new Date(
                  (config as Record<string, unknown>).anniversaryDate as string | Date,
                ).toISOString(),
                birthDate1: (config as Record<string, unknown>).birthDate1
                  ? new Date((config as Record<string, unknown>).birthDate1 as string | Date).toISOString()
                  : null,
                birthDate2: (config as Record<string, unknown>).birthDate2
                  ? new Date((config as Record<string, unknown>).birthDate2 as string | Date).toISOString()
                  : null,
              }
            : null
        }
        galleryPhotos={gallery.latestPhotos}
        photoCount={gallery.photoCount}
        summaries={{ timeline, notes, games, wishlist, letters }}
        loveMeterTargets={loveMeterTargets}
      />
    </PageTransition>
  );
}
