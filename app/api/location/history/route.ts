import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserCoupleId } from "@/lib/couple";
import { getJakartaParts } from "@/lib/date";

export const dynamic = "force-dynamic";

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

    // Optional duration range filter: "today" | "24h" | "3d" | "7d" | "all"
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
      } else if (range === "all") {
        since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
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
    if (Array.isArray(shares) && shares.length > 0) {
      const hidden = new Set(shares.filter((s) => s.isSharing === false).map((s) => s.userId));
      hidden.delete(userId);
      visibleIds = visibleIds.filter((v) => !hidden.has(v));
    }

    const whereClause: {
      userId: { in: string[] };
      createdAt?: { gte: Date };
    } = {
      userId: { in: visibleIds },
    };
    if (since) {
      whereClause.createdAt = { gte: since };
    }

    const HISTORY_LIMIT = 2000;
    const history = await prisma.userLocationHistory.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
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

    // Hitting the cap means older fixes inside the chosen range were dropped.
    // Report it so the UI can ask for a narrower range instead of silently
    // showing an incomplete trail.
    const truncated = history.length >= HISTORY_LIMIT;
    return NextResponse.json(
      { data: history, range: range ?? "all", count: history.length, truncated },
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

async function getPartnerId(userId: string, coupleId: string): Promise<string | null> {
  const partner = await prisma.coupleMember.findFirst({
    where: { coupleId, userId: { not: userId } },
    select: { userId: true },
  });
  return partner?.userId ?? null;
}
