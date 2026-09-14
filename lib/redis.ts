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
    // ponytail: fail-open is intentional (dev without redis) — but warn once so prod misconfig is visible.
    if (process.env.NODE_ENV === "production") {
      console.warn("[rate-limit] Redis missing — rate limiting DISABLED");
    }
    return { allowed: true, remaining: maxRequests, reset: 0 };
  }

  const now = Math.floor(Date.now() / 1000);
  const windowKey = `ratelimit:${key}:${Math.floor(now / windowSeconds)}`;

  try {
    const current = await redis.incr(windowKey);

    if (current === 1) {
      await redis.expire(windowKey, windowSeconds);
    }

    if (current > maxRequests) {
      // ponytail: self-heal a leaked bucket (expire lost on an earlier blip)
      // instead of 429-ing forever — happy path costs zero extra RTT.
      try {
        if ((await redis.ttl(windowKey)) === -1) {
          await redis.expire(windowKey, windowSeconds);
          return { allowed: true, remaining: maxRequests - 1, reset: now + windowSeconds };
        }
      } catch {
        return { allowed: true, remaining: maxRequests, reset: 0 };
      }
    }

    return {
      allowed: current <= maxRequests,
      remaining: Math.max(0, maxRequests - current),
      reset: Math.ceil(now / windowSeconds) * windowSeconds,
    };
  } catch {
    // ponytail: fail-open — Redis outage must not turn writes into 500s.
    return { allowed: true, remaining: maxRequests, reset: 0 };
  }
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
    // ponytail: pipeline SCAN rounds — was strictly sequential RTTs.
    const pending: Promise<unknown>[] = [];

    do {
      const result = await redis.scan(cursor, { match: matchPattern, count: 100 }) as [string, string[]];
      cursor = result[0];
      const keys = result[1];

      if (keys.length > 0) {
        pending.push(redis.del(...keys));
        // bound concurrency so a huge namespace can't fan out unbounded.
        if (pending.length >= 4) await Promise.all(pending.splice(0));
      }
    } while (Number(cursor) !== 0);
    if (pending.length > 0) await Promise.all(pending);
  } catch {
  }
}

export function cacheKey(...parts: string[]): string {
  return parts.join(":");
}
