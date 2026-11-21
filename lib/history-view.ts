import { haversineMeters } from "./geo";
import { getJakartaDateOnly } from "./date";
import { MAX_HISTORY_ACCURACY_METERS } from "./location";
import { detectStopPoints, hasTrackMovement, type VisitedStop } from "./location-history";
import type { LocationHistoryPoint } from "@/hooks/useLocation";

/**
 * One view model for the map and the card. Both render this exact object, so
 * a stop numbered "Kunjungan #2" means the same place in both places.
 */

export type HistoryFilter = "all" | "partner" | "self";

export type HistoryUserView = {
  userId: string | null;
  points: LocationHistoryPoint[];
  /** Chronological runs with no teleport/gap inside them. */
  segments: LocationHistoryPoint[][];
  stops: VisitedStop[];
  movement: boolean;
};

export type HistoryView = {
  self: HistoryUserView;
  partner: HistoryUserView;
  summary: {
    segmentCount: number;
    stopCount: number;
    movement: boolean;
    oldestAt: string | null;
    newestAt: string | null;
    spanMinutes: number;
  };
};

const MAX_SEGMENT_GAP_MS = 15 * 60_000;
const MAX_SAME_PLACE_GAP_MS = 6 * 60 * 60_000;
const SAME_PLACE_RADIUS_M = 25;
const MAX_IMPLIED_SPEED_MPS = 120;
const MIN_OUTLIER_TOLERANCE_M = 30;

/** One label, used by both the map popup and the card list. */
export function stopOrdinalLabel(index: number): string {
  return `Kunjungan #${index + 1}`;
}

function timeOf(point: LocationHistoryPoint): number {
  const t = new Date(point.createdAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

function cleanPoints(raw: LocationHistoryPoint[]): LocationHistoryPoint[] {
  const sorted = raw
    .filter(
      (p) =>
        Number.isFinite(p.latitude) &&
        Number.isFinite(p.longitude) &&
        (p.accuracy === null || p.accuracy <= MAX_HISTORY_ACCURACY_METERS),
    )
    .sort((a, b) => timeOf(a) - timeOf(b));

  // Rows replayed from the outbox can arrive with identical coordinates; a
  // zero-length run only creates a fake pin.
  return sorted.filter((p, index) => {
    if (index === 0) return true;
    const previous = sorted[index - 1];
    return (
      previous.latitude !== p.latitude ||
      previous.longitude !== p.longitude ||
      timeOf(p) - timeOf(previous) > 5_000
    );
  });
}

function splitSegments(points: LocationHistoryPoint[]): LocationHistoryPoint[][] {
  if (points.length === 0) return [];
  const segments: LocationHistoryPoint[][] = [[points[0]]];

  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    const previous = points[i - 1];
    const dt = (timeOf(point) - timeOf(previous)) / 1000;
    const moved = haversineMeters(
      { latitude: previous.latitude, longitude: previous.longitude },
      { latitude: point.latitude, longitude: point.longitude },
    );
    const tolerance = Math.max(
      previous.accuracy ?? 0,
      point.accuracy ?? 0,
      MIN_OUTLIER_TOLERANCE_M,
    );
    const teleported =
      dt > 0 && moved / dt > MAX_IMPLIED_SPEED_MPS && moved > tolerance * 3;

    // A long silence at nearly the same spot is sparse GPS, not a new trip.
    // This mirrors detectStopPoints' same-day sparse-gap rule, so one visit at
    // home does not become four one-point segments with stacked "Mulai" pins.
    const samePlace =
      timeOf(point) - timeOf(previous) > MAX_SEGMENT_GAP_MS &&
      timeOf(point) - timeOf(previous) <= MAX_SAME_PLACE_GAP_MS &&
      moved <= SAME_PLACE_RADIUS_M &&
      getJakartaDateOnly(new Date(point.createdAt)) ===
        getJakartaDateOnly(new Date(previous.createdAt));

    if (
      !samePlace &&
      (timeOf(point) - timeOf(previous) > MAX_SEGMENT_GAP_MS || teleported)
    ) {
      segments.push([point]);
    } else {
      segments[segments.length - 1].push(point);
    }
  }

  return segments.filter((segment) => segment.length > 0);
}

function buildUser(userId: string | null, raw: LocationHistoryPoint[]): HistoryUserView {
  const points = cleanPoints(raw);
  return {
    userId,
    points,
    segments: splitSegments(points),
    stops: detectStopPoints(points, { maxAccuracyMeters: MAX_HISTORY_ACCURACY_METERS }),
    movement: hasTrackMovement(points),
  };
}

export function buildHistoryView(
  history: LocationHistoryPoint[],
  options: { selfId?: string | null; filterUser?: HistoryFilter } = {},
): HistoryView | null {
  const { selfId, filterUser = "all" } = options;
  if (!selfId) return null;

  const selfRaw = history.filter((p) => p.userId === selfId);
  const partnerId = history.find((p) => p.userId !== selfId)?.userId ?? null;
  const partnerRaw = partnerId ? history.filter((p) => p.userId === partnerId) : [];

  const self = buildUser(selfId, filterUser === "partner" ? [] : selfRaw);
  const partner = buildUser(partnerId, filterUser === "self" ? [] : partnerRaw);

  const visible = [...self.points, ...partner.points];
  const times = visible.map(timeOf).filter((t) => t > 0);
  const oldest = times.length > 0 ? Math.min(...times) : null;
  const newest = times.length > 0 ? Math.max(...times) : null;

  return {
    self,
    partner,
    summary: {
      segmentCount: self.segments.length + partner.segments.length,
      stopCount: self.stops.length + partner.stops.length,
      movement: hasTrackMovement(visible),
      oldestAt: oldest !== null ? new Date(oldest).toISOString() : null,
      newestAt: newest !== null ? new Date(newest).toISOString() : null,
      spanMinutes: oldest !== null && newest !== null ? Math.round((newest - oldest) / 60_000) : 0,
    },
  };
}
