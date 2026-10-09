import { prisma } from "@/lib/prisma";
import { getCached, setCached, cacheKey } from "@/lib/redis";

export type PublicCoupleConfig = {
  name1: string;
  name2: string;
  tagline: string | null;
  heroPhotoUrl: string | null;
  heroCrop: unknown;
  anniversaryDate: string;
  birthDate1: string | null;
  birthDate2: string | null;
};

const CACHE_TTL = 300;

/** Shared server-side read of the singleton CoupleConfig. Fail-open (null). */
export async function getPublicCoupleConfig(): Promise<PublicCoupleConfig | null> {
  try {
    const cached = await getCached<PublicCoupleConfig>(cacheKey("couple", "config"));
    if (cached) return cached;

    const config = await prisma.coupleConfig.findFirst({ take: 1 });
    if (!config) return null;

    const result: PublicCoupleConfig = {
      name1: config.name1,
      name2: config.name2,
      tagline: config.tagline,
      heroPhotoUrl: config.heroPhotoUrl,
      heroCrop: config.heroCrop,
      anniversaryDate: config.anniversaryDate.toISOString(),
      birthDate1: config.birthDate1 ? config.birthDate1.toISOString() : null,
      birthDate2: config.birthDate2 ? config.birthDate2.toISOString() : null,
    };
    await setCached(cacheKey("couple", "config"), result, CACHE_TTL);
    return result;
  } catch {
    return null;
  }
}
