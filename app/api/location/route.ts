import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateLocationSchema } from "@/lib/validations/location";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";
import { detectDeviceType } from "@/lib/device";
import { MEET_THRESHOLD_METERS, LOCATION_STALE_AFTER_SECONDS } from "@/lib/geo";
import { notifyLocationReonline } from "@/lib/activity";
import {
  writeLocationFixes,
  toFixInput,
  isReonlineMoment,
} from "@/lib/location-write";

export const dynamic = "force-dynamic";

class SharingDisabledError extends Error {}

type LocationPayload = {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  altitude: number | null;
  /** Device time of the fix (kept under the old field name for clients). */
  updatedAt: string;
} | null;

type LocationRow = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  altitude: number | null;
  recordedAt: Date;
};

function toLocationPayload(row: LocationRow | null): LocationPayload {
  if (!row) return null;
  return {
    lat: row.latitude,
    lng: row.longitude,
    accuracy: row.accuracy,
    heading: row.heading,
    speed: row.speed,
    altitude: row.altitude,
    updatedAt: row.recordedAt.toISOString(),
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
          recordedAt: true,
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
          recordedAt: true,
          deviceType: true,
        },
      }),
    ]);

    const now = Date.now();
    // Age comes from the device timestamp: a row advanced by a late retry is
    // not evidence that the GPS is live.
    const selfAge = selfLocation
      ? Math.round((now - selfLocation.recordedAt.getTime()) / 1000)
      : null;
    const partnerAge = partnerLocation
      ? Math.round((now - partnerLocation.recordedAt.getTime()) / 1000)
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

    const now = new Date();
    const fix = toFixInput(parsed.data, now);

    const result = await prisma.$transaction(async (tx) => {
      // Re-check inside the write transaction so an opt-out that committed
      // after the fast pre-check above aborts this write. The GET read gate
      // remains authoritative if a row survives an overlapping commit.
      const currentShare = await tx.locationShare.findUnique({
        where: { userId },
        select: { isSharing: true },
      });
      if (!currentShare?.isSharing) throw new SharingDisabledError();

      return writeLocationFixes(tx, { userId, coupleId, fixes: [fix] });
    });

    if (result.applied) {
      // Await before returning: serverless freezes the invocation after the
      // response, so a fire-and-forget Pusher call can be dropped entirely.
      await triggerCoupleEvent(coupleId, "LOCATION");
    }

    if (
      result.applied &&
      isReonlineMoment(result.previousRecordedAt, result.lastRecordedAt, now)
    ) {
      await notifyLocationReonline(
        coupleId,
        userId,
        rateCheck.session.user.name ?? null,
        result.previousRecordedAt,
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
