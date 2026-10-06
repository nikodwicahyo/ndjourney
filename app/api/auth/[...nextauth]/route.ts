import { handlers } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withAnonymousRateLimit, rateLimitConfigs } from "@/lib/rate-limit";

type Handler = (
  req: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response>;

const wrap = (fn: Handler, throttlePosts = false): Handler => {
  return async (req, context) => {
    try {
      // credential-stuffing throttle on auth POSTs only —
      // GET /session polling must stay unthrottled.
      if (throttlePosts && req.method === "POST") {
        const rl = await withAnonymousRateLimit(req, { ...rateLimitConfigs.auth });
        if (!rl.allowed) {
          return rl.response ?? NextResponse.json({ error: "Terlalu banyak permintaan. Coba lagi nanti." }, { status: 429 });
        }
      }
      return await fn(req, context);
    } catch (e) {
      console.error("Auth handler error:", e);
      return NextResponse.json({ error: "Auth handler error" }, { status: 500 });
    }
  };
};

export const GET = wrap(handlers.GET as Handler);
export const POST = wrap(handlers.POST as Handler, true);
