import { NextResponse } from "next/server";
import { withAnonymousRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    // ponytail: unauthenticated by design (report-uri) — throttle noise/spam per-IP.
    const rl = await withAnonymousRateLimit(request, { maxRequests: 60, windowSeconds: 3600, keyPrefix: "csp" });
    if (!rl.allowed) return rl.response ?? new Response(null, { status: 429 });

    const body = await request.json().catch(() => null);
    if (body) {
      console.warn(
        "[CSP-VIOLATION]",
        JSON.stringify({
          blocked: body["blocked-uri"],
          directive: body["violated-directive"],
          doc: body["document-uri"],
          sample: body["script-sample"]?.slice(0, 120),
        }),
      );
    }
  } catch {
    // ignore
  }
  return new Response(null, { status: 204 });
}
