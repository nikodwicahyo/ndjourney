import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { withRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    // Explicit auth guard — 401 deterministic, independent of withRateLimit internals.
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Same rate-limit helper + limit (60/h) as app/api/pusher/auth/route.ts.
    const rateCheck = await withRateLimit(req, {
      maxRequests: 60,
      windowSeconds: 3600,
      keyPrefix: "push-subscribe",
    });
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }
    const userId = session.user.id;

    const body = (await req.json()) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    const { endpoint: rawEndpoint, keys } = body;
    const { p256dh, auth: authKey } = keys ?? {};

    // Push endpoint must be https:// before storage — no SSRF surface at send time.
    let endpoint = rawEndpoint;
    let url: URL;
    try {
      url = new URL(endpoint ?? "");
    } catch {
      return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
    }
    if (url.protocol !== "https:") {
      return NextResponse.json({ error: "Endpoint must use https" }, { status: 400 });
    }
    endpoint = url.href;
    if (!p256dh || !authKey) {
      return NextResponse.json({ error: "Missing push keys" }, { status: 400 });
    }

    const member = await prisma.coupleMember.findUnique({
      where: { userId },
      select: { coupleId: true },
    });
    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userAgent = req.headers.get("user-agent") ?? null;

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh: p256dh!, auth: authKey!, userAgent },
      create: {
        endpoint,
        p256dh: p256dh!,
        auth: authKey!,
        userId,
        coupleId: member.coupleId,
        userAgent,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PUSH_SUBSCRIBE_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
