import { haversineMeters } from "@/lib/geo";
import type { LocationFix } from "./types";

/** Movement that is worth a request, even when GPS accuracy is unchanged. */
export const MOVE_THRESHOLD_METERS = 5;
/** A stationary phone still proves it is alive this often. */
export const HEARTBEAT_INTERVAL_MS = 30_000;
/** An accuracy gain only counts when it is at least this much better. */
export const ACCURACY_IMPROVEMENT_RATIO = 0.85;

/**
 * The posting gate.
 *
 * The old gate only posted on an accuracy improvement, so a walking phone with
 * stable accuracy never sent a fix — the partner's pin froze in place. Movement
 * and the heartbeat are now first-class reasons to post.
 */
export function shouldPost(
  previous: LocationFix | null,
  next: LocationFix,
  now: number,
): boolean {
  if (!previous) return true;

  const moved = haversineMeters(
    { latitude: previous.latitude, longitude: previous.longitude },
    { latitude: next.latitude, longitude: next.longitude },
  );
  if (moved >= MOVE_THRESHOLD_METERS) return true;

  if (
    previous.accuracy !== null &&
    next.accuracy !== null &&
    next.accuracy > 0 &&
    next.accuracy <= previous.accuracy * ACCURACY_IMPROVEMENT_RATIO
  ) {
    return true;
  }

  const previousAt = Date.parse(previous.recordedAt);
  if (Number.isFinite(previousAt) && now - previousAt >= HEARTBEAT_INTERVAL_MS) {
    return true;
  }

  return false;
}
