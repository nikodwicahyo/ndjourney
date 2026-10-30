import { prisma } from "@/lib/prisma";
import { getCached, setCached, cacheKey } from "@/lib/redis";

const CACHE_TTL = 30;

const wishSelect = {
  id: true,
  title: true,
  description: true,
  imageUrl: true,
  imageCrop: true,
  link: true,
  category: true,
  isDone: true,
  doneAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type WishListResponse = {
  data: PrismaWish[];
  total: number;
  page: number;
  limit: number;
};

type PrismaWish = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  imageCrop: unknown;
  link: string | null;
  category: string | null;
  isDone: boolean;
  doneAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Couple-scoped wish list. Legacy rows are attributed at couple formation (see
 * the authz migration / ensureCouple), so a coupled caller sees the whole
 * couple. A not-yet-adopted row stays visible only to its creator - the same
 * ownership rule wishes/photos/milestones use for writes.
 * Single source for GET /api/wishes and the dashboard wishlist page's
 * server-side hydration — both must stay in lockstep.
 */
export async function listWishes(coupleId: string, userId: string, page = 1, limit = 50): Promise<WishListResponse> {
  const cacheK = cacheKey("wishes", "list", coupleId, userId, String(page), String(limit));
  const cached = await getCached<WishListResponse>(cacheK);
  if (cached) return cached;

  const where = {
    OR: [
      { coupleId },
      { coupleId: null, createdById: userId },
    ],
  };

  const [wishes, total] = await Promise.all([
    prisma.wishItem.findMany({
      where,
      orderBy: [
        { isDone: "asc" },
        { createdAt: "desc" },
      ],
      skip: (page - 1) * limit,
      take: limit,
      select: wishSelect,
    }),
    prisma.wishItem.count({ where }),
  ]);

  const response = toJsonSafe({ data: wishes, total, page, limit });
  await setCached(cacheK, response, CACHE_TTL);
  return response;
}

/**
 * Cache-hit responses arrive JSON-deserialized while fresh Prisma rows carry
 * Date objects. Normalizing to plain JSON keeps the route payload and the
 * RSC-hydrated payload byte-identical for consumers regardless of cache state.
 */
function toJsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
