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

// P-10: reuse across invocations in prod too (REST client construction per request is waste).
globalForRedis.redis = redis;

// Fail-open must also be FAST: a black-holed Redis host stalls each call
// ~4s+ (measured against a dead endpoint), turning one login into a 9s+ hang
// while limiter/cache/counter calls serially time out. Bound every round-trip.
const REDIS_TIMEOUT_MS = 2000;

export async function withRedisTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("[redis] timeout")), REDIS_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  if (!redis) {
    // MR-07: fail-open is intentional (dev without redis) — but in production
    // this disables ALL throttling AND caching, so log at error level with the
    // fix attached (wire this string to alerting, not just log tailing).
    if (process.env.NODE_ENV === "production") {
      console.error("[rate-limit] Redis missing — rate limiting AND cache DISABLED. Set UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN.");
    }
    return { allowed: true, remaining: maxRequests, reset: 0 };
  }

  const now = Math.floor(Date.now() / 1000);
  const windowKey = `ratelimit:${key}:${Math.floor(now / windowSeconds)}`;

  try {
    const current = await withRedisTimeout(redis.incr(windowKey));

    if (current === 1) {
      await withRedisTimeout(redis.expire(windowKey, windowSeconds));
    }

    if (current > maxRequests) {
      // self-heal a leaked bucket (expire lost on an earlier blip)
      // instead of 429-ing forever — happy path costs zero extra RTT.
      try {
        if ((await withRedisTimeout(redis.ttl(windowKey))) === -1) {
          await withRedisTimeout(redis.expire(windowKey, windowSeconds));
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
    // fail-open — Redis outage must not turn writes into 500s.
    return { allowed: true, remaining: maxRequests, reset: 0 };
  }
}

const CACHE_PREFIX = "cache:";

export async function getCached<T>(
  key: string,
): Promise<T | null> {
  if (!redis) return null;

  try {
    const data = await withRedisTimeout(redis.get<T>(`${CACHE_PREFIX}${key}`));
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
    await withRedisTimeout(redis.set(`${CACHE_PREFIX}${key}`, data, { ex: ttlSeconds }));
  } catch {
  }
}

export async function invalidateCache(pattern: string): Promise<void> {
  if (!redis) return;

  try {
    const matchPattern = `${CACHE_PREFIX}${pattern}`;
    let cursor: number | string = 0;
    // pipeline SCAN rounds — was strictly sequential RTTs.
    const pending: Promise<unknown>[] = [];

    do {
      const result = await withRedisTimeout(redis.scan(cursor, { match: matchPattern, count: 100 })) as [string, string[]];
      cursor = result[0];
      const keys = result[1];

      if (keys.length > 0) {
        pending.push(withRedisTimeout(redis.del(...keys)));
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
