import type { Prisma } from "./generated/prisma";
import { haversineMeters, LOCATION_STALE_AFTER_SECONDS } from "./geo";
import { MAX_HISTORY_ACCURACY_METERS } from "./location";

/**
 * One write path for the current position and the trail, shared by the single
 * POST and the offline batch replay. Keeping both in one transaction is what
 * makes "current row" and "history row" agree after an offline catch-up.
 */

export const HISTORY_MAX_POINTS = 2_000;
const HISTORY_MIN_MOVE_METERS = 15;
const HISTORY_MOVING_INTERVAL_MS = 30_000;
const HISTORY_STATIONARY_INTERVAL_MS = 5 * 60_000;

// A fix far worse than the current one is GPS noise (a cold start in a tunnel),
// not a real move. It may still be the newest, but it must not replace a good
// position that is only seconds old.
const ACCURACY_REGRESSION_FACTOR = 3;
const ACCURACY_REGRESSION_MIN_METERS = 50;
const ACCURACY_REGRESSION_WINDOW_MS = 60_000;

export type LocationFixInput = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  altitude: number | null;
  deviceType: string;
  recordedAt: Date;
};

// Small enough that a future-skewed device cannot freeze the marker for
// minutes; large enough to survive normal clock drift between devices.
export const MAX_FUTURE_SKEW_MS = 30_000;
export const MAX_PAST_SKEW_MS = 7 * 24 * 60 * 60_000;

/** Server-side clock clamp in both directions. */
export function toRecordedAt(value: string | null | undefined, now: Date): Date {
  if (!value) return now;
  const parsed = new Date(value);
  const time = parsed.getTime();
  if (!Number.isFinite(time)) return now;
  return new Date(
    Math.min(
      Math.max(time, now.getTime() - MAX_PAST_SKEW_MS),
      now.getTime() + MAX_FUTURE_SKEW_MS,
    ),
  );
}

export function locationWriteLockKey(userId: string): string {
  return `location-write:${userId}`;
}

/**
 * Serialize current-row read-modify-write per user. Two tabs flushing after a
 * reconnect would otherwise both pass the "newer than current" guard against
 * the same snapshot and the older one could commit last.
 */
export async function lockLocationWrite(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${locationWriteLockKey(userId)}))`;
}

export function toFixInput(
  input: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
    altitude?: number | null;
    deviceType: string;
    recordedAt?: string | null;
  },
  now: Date,
): LocationFixInput {
  return {
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy ?? null,
    heading: input.heading ?? null,
    speed: input.speed ?? null,
    altitude: input.altitude ?? null,
    deviceType: input.deviceType,
    recordedAt: toRecordedAt(input.recordedAt, now),
  };
}

/**
 * A re-online moment is only honest when the newest fix is itself fresh.
 * Replaying an old offline batch must not ring the partner's bell.
 */
export function isReonlineMoment(
  previousRecordedAt: Date | null,
  lastRecordedAt: Date | null,
  now: Date,
): boolean {
  if (!lastRecordedAt) return false;
  if (now.getTime() - lastRecordedAt.getTime() > LOCATION_STALE_AFTER_SECONDS * 1000) {
    return false;
  }
  if (!previousRecordedAt) return true;
  return (
    lastRecordedAt.getTime() - previousRecordedAt.getTime() >=
    LOCATION_STALE_AFTER_SECONDS * 1000
  );
}

export type LocationWriteResult = {
  /** The newest fix actually written to the current row, if any. */
  applied: boolean;
  /** Recorded time before this write — the honest "was GPS offline?" signal. */
  previousRecordedAt: Date | null;
  /** Recorded time after this write (may be the untouched previous value). */
  lastRecordedAt: Date | null;
  historyWritten: number;
};

type CurrentRow = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: Date;
};

type HistoryRow = {
  latitude: number;
  longitude: number;
  createdAt: Date;
};

function isWorseFix(current: CurrentRow, fix: LocationFixInput): boolean {
  if (current.accuracy === null || fix.accuracy === null) return false;
  const elapsed = fix.recordedAt.getTime() - current.recordedAt.getTime();
  if (elapsed > ACCURACY_REGRESSION_WINDOW_MS) return false;
  const ceiling = Math.max(
    current.accuracy * ACCURACY_REGRESSION_FACTOR,
    ACCURACY_REGRESSION_MIN_METERS,
  );
  return fix.accuracy > ceiling;
}

function shouldRecordHistory(
  last: HistoryRow | null,
  fix: LocationFixInput,
): boolean {
  if (fix.accuracy !== null && fix.accuracy > MAX_HISTORY_ACCURACY_METERS) {
    return false;
  }
  if (!last) return true;

  const elapsed = fix.recordedAt.getTime() - last.createdAt.getTime();
  // Device clocks can arrive out of order; never insert into the past.
  if (elapsed <= 0) return false;

  const moved = haversineMeters(
    { latitude: fix.latitude, longitude: fix.longitude },
    { latitude: last.latitude, longitude: last.longitude },
  );

  if (moved < HISTORY_MIN_MOVE_METERS) {
    return elapsed >= HISTORY_STATIONARY_INTERVAL_MS;
  }
  return elapsed >= HISTORY_MOVING_INTERVAL_MS;
}

function dedupe(fixes: LocationFixInput[]): LocationFixInput[] {
  const seen = new Set<string>();
  return fixes
    .filter((fix) => Number.isFinite(fix.recordedAt.getTime()))
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
    .filter((fix) => {
      const key = `${fix.recordedAt.getTime()}:${fix.latitude.toFixed(5)}:${fix.longitude.toFixed(5)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Apply fixes (oldest first) to the current row and the throttled trail.
 * Out-of-order and much-worse fixes are ignored for the current row, so a
 * late offline replay can never roll the live marker backwards.
 */
export async function writeLocationFixes(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    coupleId: string;
    fixes: LocationFixInput[];
  },
): Promise<LocationWriteResult> {
  const { userId, coupleId } = params;
  const fixes = dedupe(params.fixes);
  if (fixes.length === 0) {
    return { applied: false, previousRecordedAt: null, lastRecordedAt: null, historyWritten: 0 };
  }

  await lockLocationWrite(tx, userId);

  const [existing, lastHistory] = await Promise.all([
    tx.userLocation.findUnique({
      where: { userId },
      select: { latitude: true, longitude: true, accuracy: true, recordedAt: true },
    }),
    tx.userLocationHistory.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { latitude: true, longitude: true, createdAt: true },
    }),
  ]);

  const previousRecordedAt = existing?.recordedAt ?? null;
  let current: CurrentRow | null = existing;
  let last: HistoryRow | null = lastHistory;
  let latest: LocationFixInput | null = null;
  const historyRows: LocationFixInput[] = [];

  for (const fix of fixes) {
    if (current && fix.recordedAt.getTime() <= current.recordedAt.getTime()) continue;
    if (current && isWorseFix(current, fix)) continue;

    current = {
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracy: fix.accuracy,
      recordedAt: fix.recordedAt,
    };
    latest = fix;

    if (shouldRecordHistory(last, fix)) {
      historyRows.push(fix);
      last = {
        latitude: fix.latitude,
        longitude: fix.longitude,
        createdAt: fix.recordedAt,
      };
    }
  }

  if (latest) {
    await tx.userLocation.upsert({
      where: { userId },
      create: {
        userId,
        coupleId,
        latitude: latest.latitude,
        longitude: latest.longitude,
        accuracy: latest.accuracy,
        heading: latest.heading,
        speed: latest.speed,
        altitude: latest.altitude,
        deviceType: latest.deviceType,
        recordedAt: latest.recordedAt,
      },
      update: {
        latitude: latest.latitude,
        longitude: latest.longitude,
        accuracy: latest.accuracy,
        heading: latest.heading,
        speed: latest.speed,
        altitude: latest.altitude,
        deviceType: latest.deviceType,
        recordedAt: latest.recordedAt,
      },
    });
  }

  if (historyRows.length > 0) {
    await tx.userLocationHistory.createMany({
      data: historyRows.map((fix) => ({
        userId,
        coupleId,
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy,
        heading: fix.heading,
        speed: fix.speed,
        altitude: fix.altitude,
        deviceType: fix.deviceType,
        // Device time is the trail time: a replayed offline fix lands where it
        // happened, not where the network came back.
        createdAt: fix.recordedAt,
      })),
    });

    // Count cap only: "All" must really reach every stored fix. Users can
    // erase their own trail explicitly via DELETE /api/location/history.
    // Delete the exact overflow rows: a createdAt threshold would also wipe a
    // whole tie group when a batch shares one device timestamp.
    const overflow = await tx.userLocationHistory.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: HISTORY_MAX_POINTS,
      select: { id: true },
    });
    if (overflow.length > 0) {
      await tx.userLocationHistory.deleteMany({
        where: { id: { in: overflow.map((row) => row.id) } },
      });
    }
  }

  return {
    applied: latest !== null,
    previousRecordedAt,
    lastRecordedAt: latest?.recordedAt ?? previousRecordedAt,
    historyWritten: historyRows.length,
  };
}
