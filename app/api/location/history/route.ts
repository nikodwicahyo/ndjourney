import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserCoupleId } from "@/lib/couple";
import { getJakartaParts } from "@/lib/date";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { triggerCoupleEvent } from "@/lib/pusher-server";
import { MAX_HISTORY_ACCURACY_METERS } from "@/lib/location";

export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 2_000;

export async function GET(request?: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const coupleId = await getUserCoupleId(userId);
    if (!coupleId) {
      return NextResponse.json(
        { error: "Pasangan belum ditemukan" },
        { status: 404 },
      );
    }

    // Optional duration range filter: "today" | "24h" | "3d" | "7d" | "all".
    // "all" means no time cutoff (still bounded by HISTORY_LIMIT).
    let range: string | null = null;
    let since: Date | null = null;

    if (request?.url) {
      try {
        const url = new URL(request.url);
        const qRange = url.searchParams.get("range");
        if (qRange && ["today", "24h", "3d", "7d", "all"].includes(qRange)) {
          range = qRange;
        }
      } catch {
        // ignore parse error
      }
    }

    if (range) {
      const now = new Date();
      if (range === "today") {
        const parts = getJakartaParts(now);
        if (parts) {
          since = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - 7 * 60 * 60 * 1000);
        } else {
          const d = new Date(now);
          d.setHours(0, 0, 0, 0);
          since = d;
        }
      } else if (range === "24h") {
        since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (range === "3d") {
        since = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      } else if (range === "7d") {
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
      // "all" leaves `since` null so every stored fix can be selected.
    }

    // share-gated — opted-out users' trails stay private.
    // Missing share rows = legacy sharing (visible); explicit false hides.
    const partnerId = await getPartnerId(userId, coupleId);
    let visibleIds = [userId, partnerId].filter((v): v is string => !!v);
    // Fail closed: if share state cannot be read, return 500 (outer catch)
    // instead of falling back to disclosing the opted-out partner's trail.
    const shares = await prisma.locationShare.findMany({
      where: { userId: { in: visibleIds } },
      select: { userId: true, isSharing: true },
    });
    if (!Array.isArray(shares) || shares.length === 0) {
      // No consent row at all ⇒ only your own trail is yours to see.
      visibleIds = [userId];
    } else {
      // Strict allow-list: a missing/false share row is not consent. This
      // matches GET /api/location, which hides the live marker unless the
      // share row explicitly says true.
      const allowed = new Set(
        shares
          .filter((s) => s.isSharing === true && s.userId !== userId)
          .map((s) => s.userId),
      );
      visibleIds = visibleIds.filter((v) => v === userId || allowed.has(v));
    }

    const whereClause: {
      userId: { in: string[] };
      createdAt?: { gte: Date };
      OR?: Array<{ accuracy: null } | { accuracy: { lte: number } }>;
    } = {
      userId: { in: visibleIds },
      // The trail contract is the same as the write path: a 500 m fix is noise,
      // not a road. Keep null accuracy (older rows) so history is not lost.
      OR: [
        { accuracy: null },
        { accuracy: { lte: MAX_HISTORY_ACCURACY_METERS } },
      ],
    };
    if (since) {
      whereClause.createdAt = { gte: since };
    }

    // One extra row tells us the cap was actually hit, so `truncated` is exact.
    const history = await prisma.userLocationHistory.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT + 1,
      select: {
        userId: true,
        latitude: true,
        longitude: true,
        accuracy: true,
        heading: true,
        speed: true,
        createdAt: true,
        deviceType: true,
      },
    });

    const truncated = history.length > HISTORY_LIMIT;
    const points = truncated ? history.slice(0, HISTORY_LIMIT) : history;

    // Dates come from the rows actually stored/returned — no invented window.
    // `desc` order makes index 0 the newest and the last row the oldest.
    const newestAt = points[0]?.createdAt
      ? new Date(points[0].createdAt).toISOString()
      : null;
    const oldestAt = points.length > 0
      ? new Date(points[points.length - 1].createdAt).toISOString()
      : null;
    return NextResponse.json(
      {
        data: points,
        range: range ?? "all",
        count: points.length,
        truncated,
        oldestAt,
        newestAt,
      },
      { headers: { "Cache-Control": "private, no-cache" } },
    );
  } catch (error) {
    console.error("Error fetching location history:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server." },
      { status: 500 },
    );
  }
}

/** Erase every location datum we hold for the caller: trail, current row and
 *  historical re-online/share notifications. The partner's data is untouched. */
export async function DELETE(request: Request) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.write);
    if (!rateCheck.allowed) return rateCheck.response;

    const userId = rateCheck.session.user.id;
    const coupleId = await getUserCoupleId(userId);

    const [historyDeleted] = await Promise.all([
      prisma.userLocationHistory.deleteMany({ where: { userId } }),
      prisma.userLocation.deleteMany({ where: { userId } }),
      prisma.activityEvent.deleteMany({ where: { actorId: userId, type: "location" } }),
    ]);

    // Await: a fire-and-forget trigger can be killed with the invocation.
    if (coupleId) await triggerCoupleEvent(coupleId, "LOCATION");

    return NextResponse.json({ data: { deleted: historyDeleted.count } });
  } catch (error) {
    console.error("Error deleting location history:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server." },
      { status: 500 },
    );
  }
}

async function getPartnerId(userId: string, coupleId: string): Promise<string | null> {
  const partner = await prisma.coupleMember.findFirst({
    where: { coupleId, userId: { not: userId } },
    select: { userId: true },
  });
  return partner?.userId ?? null;
}
