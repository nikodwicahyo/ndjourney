import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateLocationSchema } from "@/lib/validations/location";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";
import { detectDeviceType } from "@/lib/device";
import { MEET_THRESHOLD_METERS, LOCATION_STALE_AFTER_SECONDS, haversineMeters } from "@/lib/geo";
import { notifyLocationReonline } from "@/lib/activity";

export const dynamic = "force-dynamic";

class SharingDisabledError extends Error {}

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

    // avatar comes from the session (refreshed on PROFILE via updateSession) — was a 4th query.
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
    // Read-side gate: a surviving row must never be disclosed after opt-out.
    const partnerSharing = partnerShare?.isSharing === true;

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
        isStale: selfAge !== null && selfAge > LOCATION_STALE_AFTER_SECONDS,
      },
      partner: {
        userId: partner.id,
        name: partner.name ?? "Pasangan",
        image: partner.image,
        isSharing: partnerSharing,
        deviceType: partnerSharing ? (partnerLocation?.deviceType ?? null) : null,
        location: partnerSharing ? toLocationPayload(partnerLocation) : null,
        locationAgeSeconds: partnerSharing ? partnerAge : null,
        isStale: partnerSharing && partnerAge !== null && partnerAge > LOCATION_STALE_AFTER_SECONDS,
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

    // P-11: current position + history in ONE transaction — a history-trim rollback
    // used to leave the current row advanced past the trail.
    const { previousUpdatedAt } = await prisma.$transaction(async (tx) => {
      // Re-check inside the write transaction so an opt-out that committed
      // after the fast pre-check above aborts this write. The GET read gate
      // remains authoritative if a row survives an overlapping commit.
      const currentShare = await tx.locationShare.findUnique({
        where: { userId },
        select: { isSharing: true },
      });
      if (!currentShare?.isSharing) throw new SharingDisabledError();

      // The previous fix's age is the only honest "was GPS offline?" signal:
      // the location card calls the same 60 s gap "Offline". Read inside the
      // write transaction so the value matches the row being advanced.
      const existing = await tx.userLocation.findUnique({
        where: { userId },
        select: { updatedAt: true },
      });
      const previousUpdatedAt = existing?.updatedAt ?? null;

      // Upsert current location
      await tx.userLocation.upsert({
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

      // Write to location history (throttled):
      // If user moved >= 15 meters, record after 30 seconds.
      // If stationary (< 15 meters), record every 5 minutes to confirm dwell without database spamming.
      const lastHistory = await tx.userLocationHistory.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, latitude: true, longitude: true },
      });

      if (lastHistory) {
        const elapsedMs = now.getTime() - lastHistory.createdAt.getTime();
        const movedMeters = haversineMeters(
          { latitude, longitude },
          { latitude: lastHistory.latitude, longitude: lastHistory.longitude },
        );
        if (movedMeters < 15 && elapsedMs < 300000) {
          return { previousUpdatedAt };
        }
        if (movedMeters >= 15 && elapsedMs < 30000) {
          return { previousUpdatedAt };
        }
      }

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

      // No time-based pruning: the All filter must really reach every stored fix.
      // Only a count cap keeps the table bounded; users can erase their own
      // trail explicitly via DELETE /api/location/history.
      const maxPoints = 2000;
      const oldestAllowed = await tx.userLocationHistory.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: maxPoints,
        take: 1,
        select: { createdAt: true },
      });
      if (oldestAllowed.length > 0) {
        await tx.userLocationHistory.deleteMany({
          where: { userId, createdAt: { lte: oldestAllowed[0].createdAt } },
        });
      }

      return { previousUpdatedAt };
    });

    triggerCoupleEvent(coupleId, "LOCATION");

    // A normal 8–30 s ping stays silent. Only a fix that ended a real offline
    // gap is a "partner is back online" moment worth the bell + push. Gated
    // here so the cooldown query runs only on a recovery, not every ping.
    if (
      previousUpdatedAt === null ||
      now.getTime() - previousUpdatedAt.getTime() >=
        LOCATION_STALE_AFTER_SECONDS * 1000
    ) {
      await notifyLocationReonline(
        coupleId,
        userId,
        rateCheck.session.user.name ?? null,
        previousUpdatedAt,
      );
    }

    return NextResponse.json({ data: { ok: true } }, { status: 200 });
  } catch (error) {
    if (error instanceof SharingDisabledError) {
      return NextResponse.json(
        { error: "Kamu belum mengaktifkan berbagi lokasi" },
        { status: 403 },
      );
    }
    console.error("Error updating location:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
