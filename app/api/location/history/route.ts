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

    const history = await prisma.userLocationHistory.findMany({
      where: { userId: { in: [userId, (await getPartnerId(userId, coupleId))].filter(Boolean) as string[] } },
      orderBy: { createdAt: "desc" },
      take: 50,
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
