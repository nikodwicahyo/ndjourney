import { bearing, haversineMeters } from "./geo";

/** A real device fix, before it becomes an HTTP payload. */
export type LocationFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  altitude: number | null;
  /** Device clock time of the fix (ms since epoch). */
  recordedAt: number;
};

export type PostedFix = LocationFix & { postedAt: number };

export const MOVING_POST_MS = 5_000;
export const STATIONARY_POST_MS = 30_000;
export const MIN_MOVE_METERS = 5;
export const ACCURACY_IMPROVEMENT_RATIO = 0.8;
export const MAX_IMPLIED_SPEED_MPS = 120;
export const MAX_FUTURE_SKEW_MS = 5 * 60_000;
export const MAX_OUTBOX_AGE_MS = 7 * 24 * 60 * 60_000;
export const MAX_OUTBOX_POINTS = 2_000;
export const MAX_HISTORY_ACCURACY_METERS = 100;

const EARTH_RADIUS_M = 6_371_000;

/** Device clocks drift and can be wrong; never trust a future timestamp. */
export function normalizeRecordedAt(value: number | null | undefined, now = Date.now()): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return now;
  return Math.min(value as number, now + MAX_FUTURE_SKEW_MS);
}

export function isValidFix(fix: LocationFix): boolean {
  return (
    Number.isFinite(fix.latitude) &&
    Number.isFinite(fix.longitude) &&
    Math.abs(fix.latitude) <= 90 &&
    Math.abs(fix.longitude) <= 180 &&
    Number.isFinite(fix.recordedAt) &&
    (fix.accuracy === null || (Number.isFinite(fix.accuracy) && fix.accuracy >= 0))
  );
}

/** Fill missing speed/heading from consecutive fixes so history/stops stay useful. */
export function deriveMotion(fix: LocationFix, previous: LocationFix | null): LocationFix {
  if (!previous) return fix;
  const dt = (fix.recordedAt - previous.recordedAt) / 1000;
  if (!Number.isFinite(dt) || dt <= 0) return fix;

  const moved = haversineMeters(
    { latitude: previous.latitude, longitude: previous.longitude },
    { latitude: fix.latitude, longitude: fix.longitude },
  );

  return {
    ...fix,
    speed: fix.speed ?? moved / dt,
    heading:
      fix.heading ??
      (moved >= 2
        ? bearing(
            { latitude: previous.latitude, longitude: previous.longitude },
            { latitude: fix.latitude, longitude: fix.longitude },
          )
        : null),
  };
}

/** A jump no vehicle could make in the elapsed time is GPS noise, not movement. */
export function isOutlier(previous: LocationFix | null, fix: LocationFix): boolean {
  if (!previous) return false;
  const dt = (fix.recordedAt - previous.recordedAt) / 1000;
  if (!Number.isFinite(dt) || dt <= 0) return false;
  const moved = haversineMeters(
    { latitude: previous.latitude, longitude: previous.longitude },
    { latitude: fix.latitude, longitude: fix.longitude },
  );
  const impliedSpeed = moved / dt;
  const tolerance = Math.max(fix.accuracy ?? 0, previous.accuracy ?? 0, 30);
  return impliedSpeed > MAX_IMPLIED_SPEED_MPS && moved > tolerance * 3;
}

export function shouldPost(
  last: PostedFix | null,
  fix: LocationFix,
  now = Date.now(),
): boolean {
  if (!last) return true;

  const elapsed = now - last.postedAt;
  if (!Number.isFinite(elapsed) || elapsed < 0) return true;

  const moved = haversineMeters(
    { latitude: last.latitude, longitude: last.longitude },
    { latitude: fix.latitude, longitude: fix.longitude },
  );
  const moving = (fix.speed ?? 0) > 1 || moved >= MIN_MOVE_METERS;

  if (moving && moved >= MIN_MOVE_METERS && elapsed >= MOVING_POST_MS) return true;
  if (!moving && elapsed >= STATIONARY_POST_MS) return true;

  const previousAccuracy = last.accuracy;
  if (
    previousAccuracy !== null &&
    fix.accuracy !== null &&
    elapsed >= 2_000 &&
    fix.accuracy < previousAccuracy * ACCURACY_IMPROVEMENT_RATIO
  ) {
    return true;
  }

  return false;
}

export function distanceMeters(a: LocationFix, b: LocationFix): number {
  return haversineMeters(
    { latitude: a.latitude, longitude: a.longitude },
    { latitude: b.latitude, longitude: b.longitude },
  );
}

/** Kept for callers that need a stable rounded key without importing geo. */
export function trailKey(fix: { latitude: number; longitude: number }): string {
  return `${fix.latitude.toFixed(5)},${fix.longitude.toFixed(5)}`;
}

export { EARTH_RADIUS_M };
