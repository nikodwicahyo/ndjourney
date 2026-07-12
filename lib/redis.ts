import { Redis } from "@upstash/redis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function getRedis(): Redis | undefined {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return undefined;

  return new Redis({ url, token });
}

export const redis = globalForRedis.redis ?? getRedis();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  if (!redis) {
    return { allowed: true, remaining: maxRequests, reset: 0 };
  }

  const now = Math.floor(Date.now() / 1000);
  const windowKey = `ratelimit:${key}:${Math.floor(now / windowSeconds)}`;

  const current = await redis.incr(windowKey);

  if (current === 1) {
    await redis.expire(windowKey, windowSeconds);
  }

  return {
    allowed: current <= maxRequests,
    remaining: Math.max(0, maxRequests - current),
    reset: Math.ceil(now / windowSeconds) * windowSeconds,
  };
}

const CACHE_PREFIX = "cache:";

export async function getCached<T>(
  key: string,
): Promise<T | null> {
  if (!redis) return null;

  try {
    const data = await redis.get<T>(`${CACHE_PREFIX}${key}`);
    return data ?? null;
  } catch {
    return null;
  }
}

export async function setCached<T>(
  key: string,
  data: T,
  ttlSeconds: number,
): Promise<void> {
  if (!redis) return;

  try {
    await redis.set(`${CACHE_PREFIX}${key}`, data, { ex: ttlSeconds });
  } catch {
  }
}

export async function invalidateCache(pattern: string): Promise<void> {
  if (!redis) return;

  try {
    const matchPattern = `${CACHE_PREFIX}${pattern}`;
    let cursor: number | string = 0;

    do {
      const result = await redis.scan(cursor, { match: matchPattern, count: 100 }) as [string, string[]];
      cursor = result[0];
      const keys = result[1];

      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (Number(cursor) !== 0);
  } catch {
  }
}

export function cacheKey(...parts: string[]): string {
  return parts.join(":");
}
