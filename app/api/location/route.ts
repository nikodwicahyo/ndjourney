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
import { checkActiveShare, isPlausibleFix, parseJsonBody, shareError } from "@/lib/location/server";
import type { TrackingState } from "@/lib/location/types";

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

type ShareView = {
  isSharing: boolean;
  expiresAt: Date | null;
  lastSeenAt: Date | null;
  trackingState: string | null;
} | null;

function isShareActive(share: ShareView, now: number): boolean {
  return (
    share?.isSharing === true &&
    !(share.expiresAt !== null && share.expiresAt.getTime() <= now)
  );
}

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
        select: { isSharing: true, expiresAt: true, lastSeenAt: true, trackingState: true },
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
        select: { isSharing: true, expiresAt: true, lastSeenAt: true, trackingState: true },
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
    // Read-side gate: a surviving row must never be disclosed after opt-out or
    // after a time-bounded share expires. The lazy DB opt-out is only cleanup.
    const selfSharing = isShareActive(selfShare, now);
    const partnerSharing = isShareActive(partnerShare, now);

    const data = {
      meetThresholdMeters: MEET_THRESHOLD_METERS,
      coupleId,
      self: {
        userId,
        name: session.user.name ?? null,
        image: session.user.image ?? null,
        isSharing: selfSharing,
        deviceType: selfLocation?.deviceType ?? detectDeviceType(),
        location: toLocationPayload(selfLocation),
        locationAgeSeconds: selfAge,
        isStale: selfAge !== null && selfAge > LOCATION_STALE_AFTER_SECONDS,
        lastSeenAt: selfShare?.lastSeenAt?.toISOString() ?? null,
        lastFixAt: selfLocation?.updatedAt.toISOString() ?? null,
        trackingState: (selfShare?.trackingState as TrackingState | null) ?? null,
        shareExpiresAt: selfShare?.expiresAt?.toISOString() ?? null,
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
        lastSeenAt: partnerSharing ? (partnerShare?.lastSeenAt?.toISOString() ?? null) : null,
        lastFixAt: partnerSharing ? (partnerLocation?.updatedAt.toISOString() ?? null) : null,
        trackingState: partnerSharing
          ? ((partnerShare?.trackingState as TrackingState | null) ?? null)
          : null,
        shareExpiresAt: partnerSharing ? (partnerShare?.expiresAt?.toISOString() ?? null) : null,
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

    const body = await parseJsonBody(request);
    if (body == null) return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    const parsed = updateLocationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data lokasi tidak valid" },
        { status: 400 },
      );
    }

    const {
      latitude,
      longitude,
      accuracy,
      heading,
      speed,
      altitude,
      deviceType,
      clientId,
      recordedAt,
      trackingState,
    } = parsed.data;

    const now = new Date();
    const fixAt = recordedAt ? new Date(recordedAt) : now;

    const result = await prisma.$transaction(async (tx) => {
      const shareCheck = await checkActiveShare(tx, userId, now);
      if (!shareCheck.ok) return { ok: false as const, code: shareCheck.code, coupleId: "" };

      const existing = await tx.userLocation.findUnique({
        where: { userId },
        select: { updatedAt: true, latitude: true, longitude: true },
      });
      const previousUpdatedAt = existing?.updatedAt ?? null;

      // Current position always advances the live pin — even an implausible
      // jump is better than freezing. Only the persistent trail is filtered.
      await tx.userLocation.upsert({
        where: { userId },
        create: {
          userId,
          coupleId: shareCheck.coupleId,
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

      await tx.locationShare.update({
        where: { userId },
        data: { lastSeenAt: now, trackingState: trackingState ?? "foreground" },
      });

      if (existing && !isPlausibleFix(existing, { latitude, longitude }, fixAt)) {
        return { ok: true as const, coupleId: shareCheck.coupleId, previousUpdatedAt, duplicate: false };
      }

      // Trail throttle: 15 m / 30 s while moving, 5 min while stationary.
      const lastHistory = await tx.userLocationHistory.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, latitude: true, longitude: true },
      });
      if (lastHistory) {
        const elapsedMs = fixAt.getTime() - lastHistory.createdAt.getTime();
        const movedMeters = haversineMeters(
          { latitude, longitude },
          { latitude: lastHistory.latitude, longitude: lastHistory.longitude },
        );
        if (movedMeters < 15 && elapsedMs < 300_000) {
          return { ok: true as const, coupleId: shareCheck.coupleId, previousUpdatedAt, duplicate: false };
        }
        if (movedMeters >= 15 && elapsedMs < 30_000) {
          return { ok: true as const, coupleId: shareCheck.coupleId, previousUpdatedAt, duplicate: false };
        }
      }

      // createMany + skipDuplicates is idempotent without raising P2002, which
      // would abort the whole Postgres transaction.
      const inserted = await tx.userLocationHistory.createMany({
        data: [{
          userId,
          coupleId: shareCheck.coupleId,
          latitude,
          longitude,
          accuracy: accuracy ?? null,
          heading: heading ?? null,
          speed: speed ?? null,
          altitude: altitude ?? null,
          deviceType,
          createdAt: fixAt,
          clientId: clientId ?? null,
          recordedAt: clientId ? fixAt : null,
        }],
        skipDuplicates: true,
      });

      // No time-based pruning here: it used to run a skip-2000 query on every
      // single fix. A daily cron keeps the table bounded instead.
      return {
        ok: true as const,
        coupleId: shareCheck.coupleId,
        previousUpdatedAt,
        duplicate: inserted.count === 0,
      };
    });

    if (!result.ok) {
      const error = shareError(result.code);
      return NextResponse.json(error.body, { status: error.status });
    }

    triggerCoupleEvent(result.coupleId, "LOCATION");

    if (
      result.previousUpdatedAt === null ||
      now.getTime() - result.previousUpdatedAt.getTime() >=
        LOCATION_STALE_AFTER_SECONDS * 1000
    ) {
      await notifyLocationReonline(
        result.coupleId,
        userId,
        rateCheck.session.user.name ?? null,
        result.previousUpdatedAt,
      );
    }

    return NextResponse.json(
      { data: { ok: true, duplicate: result.duplicate } },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error updating location:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
