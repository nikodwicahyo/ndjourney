import { checkRateLimit } from "@/lib/redis";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

type RateLimitConfig = {
  maxRequests: number;
  windowSeconds: number;
  keyPrefix?: string;
};

const defaults: RateLimitConfig = {
  maxRequests: 30,
  windowSeconds: 3600,
  keyPrefix: "",
};

type WithRateLimitResult =
  | { allowed: false; response: NextResponse; remaining: number }
  | { allowed: true; remaining: number; session: { user: { id: string; name?: string | null; email?: string | null; image?: string | null } } };

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export async function withAnonymousRateLimit(
  request: Request,
  config: Partial<RateLimitConfig> = {},
): Promise<{ allowed: boolean; remaining: number; response?: NextResponse }> {
  const { maxRequests, windowSeconds, keyPrefix } = {
    ...defaults,
    ...config,
  };

  const ip = getClientIp(request);
  const key = keyPrefix
    ? `${keyPrefix}:anon:${ip}`
    : `rate:anon:${ip}`;

  const { allowed, remaining } = await checkRateLimit(
    key,
    maxRequests,
    windowSeconds,
  );

  if (!allowed) {
    return {
      allowed: false,
      remaining: 0,
      response: NextResponse.json(
        {
          error: `Terlalu banyak permintaan. Coba lagi dalam ${Math.ceil(windowSeconds / 60)} menit.`,
          remaining: 0,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(windowSeconds),
            "X-RateLimit-Remaining": "0",
          },
        },
      ),
    };
  }

  return { allowed: true, remaining };
}

export async function withRateLimit(
  request: Request,
  config: Partial<RateLimitConfig> = {},
): Promise<WithRateLimitResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      allowed: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      remaining: 0,
    };
  }

  const { maxRequests, windowSeconds, keyPrefix } = {
    ...defaults,
    ...config,
  };

  const key = keyPrefix
    ? `${keyPrefix}:${session.user.id}`
    : `rate:${session.user.id}`;

  const { allowed, remaining } = await checkRateLimit(
    key,
    maxRequests,
    windowSeconds,
  );

  if (!allowed) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: `Terlalu banyak permintaan. Coba lagi dalam ${Math.ceil(windowSeconds / 60)} menit.`,
          remaining: 0,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(windowSeconds),
            "X-RateLimit-Remaining": "0",
          },
        },
      ),
      remaining: 0,
    };
  }

  return { allowed: true, remaining, session: { user: session.user as { id: string; name?: string | null; email?: string | null; image?: string | null } } };
}

export const rateLimitConfigs = {
  upload: { maxRequests: 30, windowSeconds: 3600, keyPrefix: "upload" },
  bulkUpload: { maxRequests: 30, windowSeconds: 3600, keyPrefix: "upload:bulk" },
  note: { maxRequests: 100, windowSeconds: 86400, keyPrefix: "note" },
  letter: { maxRequests: 30, windowSeconds: 3600, keyPrefix: "letter" },
  register: { maxRequests: 3, windowSeconds: 3600, keyPrefix: "register" },
  write: { maxRequests: 60, windowSeconds: 3600, keyPrefix: "write" },
  auth: { maxRequests: 10, windowSeconds: 900, keyPrefix: "auth" },
  score: { maxRequests: 200, windowSeconds: 3600, keyPrefix: "score" },
} as const;
