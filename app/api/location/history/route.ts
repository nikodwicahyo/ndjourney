import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserCoupleId } from "@/lib/couple";

export const dynamic = "force-dynamic";

export async function GET() {
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

    const history = await prisma.userLocationHistory.findMany({
      where: { userId: { in: visibleIds } },
      orderBy: { createdAt: "desc" },
      take: 100,
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

    return NextResponse.json(
      { data: history },
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
