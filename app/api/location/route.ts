import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateLocationSchema } from "@/lib/validations/location";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";
import { detectDeviceType } from "@/lib/device";
import { MEET_THRESHOLD_METERS } from "@/lib/geo";

export const dynamic = "force-dynamic";

export type LocationPayload = {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  altitude: number | null;
  updatedAt: string;
} | null;

function toLocationPayload(row: {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  altitude: number | null;
  updatedAt: Date;
} | null): LocationPayload {
  if (!row) return null;
  return {
    lat: row.latitude,
    lng: row.longitude,
    accuracy: row.accuracy,
    heading: row.heading,
    speed: row.speed,
    altitude: row.altitude,
    updatedAt: row.updatedAt.toISOString(),
  };
}

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

    // ponytail: avatar comes from the session (refreshed on PROFILE via updateSession) — was a 4th query.
    const [selfShare, partnerMember, selfLocation] = await Promise.all([
      prisma.locationShare.findUnique({
        where: { userId },
        select: { isSharing: true },
      }),
      prisma.coupleMember.findFirst({
        where: { coupleId, userId: { not: userId } },
        select: {
          user: {
            select: { id: true, name: true, image: true },
          },
        },
      }),
      prisma.userLocation.findUnique({
        where: { userId },
        select: {
          latitude: true,
          longitude: true,
          accuracy: true,
          heading: true,
          speed: true,
          altitude: true,
          updatedAt: true,
          deviceType: true,
        },
      }),
    ]);
    const selfImage = { image: session.user.image ?? null };

    const partner = partnerMember?.user ?? null;
    if (!partner) {
      return NextResponse.json(
        { error: "Pasangan belum ditemukan" },
        { status: 404 },
      );
    }

    const [partnerShare, partnerLocation] = await Promise.all([
      prisma.locationShare.findUnique({
        where: { userId: partner.id },
        select: { isSharing: true },
      }),
      prisma.userLocation.findUnique({
        where: { userId: partner.id },
        select: {
          latitude: true,
          longitude: true,
          accuracy: true,
          heading: true,
          speed: true,
          altitude: true,
          updatedAt: true,
          deviceType: true,
        },
      }),
    ]);

    const now = Date.now();
    const selfAge = selfLocation
      ? Math.round((now - selfLocation.updatedAt.getTime()) / 1000)
      : null;
    const partnerAge = partnerLocation
      ? Math.round((now - partnerLocation.updatedAt.getTime()) / 1000)
      : null;

    const data = {
      meetThresholdMeters: MEET_THRESHOLD_METERS,
      coupleId,
      self: {
        userId,
        name: session.user.name ?? null,
        image: selfImage?.image ?? null,
        isSharing: selfShare?.isSharing ?? false,
        deviceType: selfLocation?.deviceType ?? detectDeviceType(),
        location: toLocationPayload(selfLocation),
        locationAgeSeconds: selfAge,
        isStale: selfAge !== null && selfAge > 60,
      },
      partner: {
        userId: partner.id,
        name: partner.name ?? "Pasangan",
        image: partner.image,
        isSharing: partnerShare?.isSharing ?? false,
        deviceType: partnerLocation?.deviceType ?? null,
        location: toLocationPayload(partnerLocation),
        locationAgeSeconds: partnerAge,
        isStale: partnerAge !== null && partnerAge > 60,
      },
    };

    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "private, no-cache" } },
    );
  } catch (error) {
    console.error("Error fetching location:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.location);
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

    const userId = rateCheck.session.user.id;
    const coupleId = await getUserCoupleId(userId);
    if (!coupleId) {
      return NextResponse.json(
        { error: "Pasangan belum ditemukan" },
        { status: 404 },
      );
    }

    const share = await prisma.locationShare.findUnique({
      where: { userId },
      select: { isSharing: true },
    });

    if (!share?.isSharing) {
      return NextResponse.json(
        { error: "Kamu belum mengaktifkan berbagi lokasi" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    if (body == null) return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    const parsed = updateLocationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data lokasi tidak valid" },
        { status: 400 },
      );
    }

    const { latitude, longitude, accuracy, heading, speed, altitude, deviceType } = parsed.data;

    const now = new Date();

    // Upsert current location
    await prisma.userLocation.upsert({
      where: { userId },
      create: {
        userId,
        coupleId,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        heading: heading ?? null,
        speed: speed ?? null,
        altitude: altitude ?? null,
        deviceType,
      },
      update: {
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        heading: heading ?? null,
        speed: speed ?? null,
        altitude: altitude ?? null,
        deviceType,
      },
    });

    // Write to location history (throttled: only if last history entry is >30s old or doesn't exist).
    // ponytail: single transaction — concurrent 8s polls from 2 tabs can't duplicate/over-trim.
    await prisma.$transaction(async (tx) => {
      const lastHistory = await tx.userLocationHistory.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      if (lastHistory && now.getTime() - lastHistory.createdAt.getTime() <= 30000) return;

      await tx.userLocationHistory.create({
        data: {
          userId,
          coupleId,
          latitude,
          longitude,
          accuracy: accuracy ?? null,
          heading: heading ?? null,
          speed: speed ?? null,
          altitude: altitude ?? null,
          deviceType,
        },
      });

      // Keep only last 50 history points per user: delete everything older than the 50th newest.
      const keep = await tx.userLocationHistory.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, createdAt: true },
      });
      if (keep.length === 50) {
        const cutoff = keep[keep.length - 1].createdAt;
        await tx.userLocationHistory.deleteMany({
          where: { userId, createdAt: { lt: cutoff } },
        });
      }
    });

    triggerCoupleEvent(coupleId, "LOCATION");

    return NextResponse.json({ data: { ok: true } }, { status: 200 });
  } catch (error) {
    console.error("Error updating location:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
