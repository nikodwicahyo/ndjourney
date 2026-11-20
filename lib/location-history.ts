import { haversineMeters } from "./geo";
import { formatInJakarta, formatJakartaTime, getJakartaDateOnly } from "./date";
import { fetchRoadRoute } from "./routing";
import type { LocationHistoryPoint } from "@/hooks/useLocation";

export type VisitedStop = {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  arrivedAt: string;
  departedAt: string;
  durationMinutes: number;
  pointCount: number;
  isCurrent: boolean;
  /** Cluster tolerance in metres; lets the map match waypoints to the right stop. */
  radiusMeters?: number;
  address?: string | null;
};

export type JourneyTimelineItem =
  | {
      type: "stop";
      stop: VisitedStop;
    }
  | {
      type: "move";
      userId: string;
      startedAt: string;
      endedAt: string;
      durationMinutes: number;
      distanceMeters: number;
      fromAddress?: string | null;
      toAddress?: string | null;
    };

export function formatDurationId(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 1) return "< 1 mnt";
  const m = Math.round(minutes);
  if (m < 1) return "< 1 mnt";
  if (m < 60) return `${m} mnt`;
  const hours = Math.floor(m / 60);
  const remainingMins = m % 60;
  if (remainingMins === 0) return `${hours} jam`;
  return `${hours} jam ${remainingMins} mnt`;
}

export function formatTimeOnly(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

/** One canonical "time range . date" label, shared by the stop list and map popup. */
export function formatStopTimeLabel(stop: VisitedStop): string {
  // Always the real first/last ping: that is exactly the span `durationMinutes`
  // is computed from. "sekarang" would disagree with it for stale fixes.
  const time = `${formatJakartaTime(stop.arrivedAt)} - ${formatJakartaTime(stop.departedAt)}`;
  const date = formatInJakarta(stop.arrivedAt, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${time} · ${date}`;
}

/**
 * Link a raw map waypoint to the stop row it belongs to. Both layers read the
 * same filtered stop array, so the index is also the card's "Kunjungan #n".
 */
export function findStopAtPoint(
  point: LocationHistoryPoint,
  stops: VisitedStop[],
): { stop: VisitedStop; index: number } | null {
  const time = new Date(point.createdAt).getTime();
  if (!Number.isFinite(time)) return null;
  const index = stops.findIndex((stop) => {
    if (stop.userId !== point.userId) return false;
    const from = new Date(stop.arrivedAt).getTime();
    const to = new Date(stop.departedAt).getTime();
    if (!Number.isFinite(from) || !Number.isFinite(to) || time < from || time > to) {
      return false;
    }
    // A time-window match alone tags a brief drive-out as "sedang di sini".
    // Require the fix to actually be at the visited place. Cap the fix's own
    // reported accuracy so one wild fix cannot claim every nearby stop.
    const tolerance = Math.max(stop.radiusMeters ?? 50, Math.min(point.accuracy ?? 0, 150));
    return (
      haversineMeters(stop, {
        latitude: point.latitude,
        longitude: point.longitude,
      }) <= tolerance
    );
  });
  return index === -1 ? null : { stop: stops[index], index };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** True only when at least one person actually moved within their own trace. */
export function hasTrackMovement(points: LocationHistoryPoint[]): boolean {
  const firstByUser = new Map<string, { latitude: number; longitude: number }>();
  return points.some((p) => {
    const first = firstByUser.get(p.userId);
    if (!first) {
      firstByUser.set(p.userId, { latitude: p.latitude, longitude: p.longitude });
      return false;
    }
    return (
      haversineMeters(first, {
        latitude: p.latitude,
        longitude: p.longitude,
      }) > 50
    );
  });
}

/**
 * Detect visited places from a chronological sequence of location points.
 *
 * Accuracy-aware and drift-resistant: fixes worse than `maxAccuracyMeters` are
 * dropped, clusters use a median centroid, and a visit needs either a real dwell
 * or several stationary pings. Consecutive nearby visits are merged only when
 * the gap between them is short (a later return to the same place is a new visit).
 */
export function detectStopPoints(
  rawPoints: LocationHistoryPoint[],
  options: {
    clusterRadiusMeters?: number;
    minDwellMinutes?: number;
    maxAccuracyMeters?: number;
    minStationaryPings?: number;
    maxGapMinutes?: number;
    mergeRadiusMeters?: number;
  } = {},
): VisitedStop[] {
  if (!rawPoints || rawPoints.length === 0) return [];

  const clusterRadius = options.clusterRadiusMeters ?? 50;
  const minDwellMinutes = options.minDwellMinutes ?? 3;
  // Indoor/city GPS routinely reports 100-150m accuracy. Dropping those fixes
  // left a real stay visible as raw map waypoints but absent from the stop card.
  // Wild drift (>150m) is still discarded; see the accuracy tests.
  const maxAccuracy = options.maxAccuracyMeters ?? 150;
  const minStationary = options.minStationaryPings ?? 3;
  const maxGapMs = (options.maxGapMinutes ?? 15) * 60_000;
  const mergeRadius = options.mergeRadiusMeters ?? 50;
  // A silence at nearly the same spot is usually sparse GPS, not a new visit.
  // Bound it in BOTH directions: a long same-day sleep at one place stays one
  // visit, while fixes on different Jakarta days are separate visits even when
  // the place (and the elapsed time) is identical.
  const sparseRadius = 25;
  const maxSparseGapMs = 6 * 60 * 60_000;

  // A stationary phone with poor GPS scatters fixes tens of metres apart. Scale
  // the cluster tolerance to the median reported accuracy so one stay is not
  // split into sub-clusters too small to become a card entry.
  const toleranceFor = (cluster: LocationHistoryPoint[]) => {
    const accuracies = cluster
      .map((p) => p.accuracy)
      .filter((a): a is number => a !== null && Number.isFinite(a));
    return Math.min(
      150,
      Math.max(clusterRadius, accuracies.length ? median(accuracies) : clusterRadius),
    );
  };

  const points = [...rawPoints]
    .filter((p) => p.accuracy === null || p.accuracy <= maxAccuracy)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  if (points.length === 0) return [];

  // Cluster by median centroid; a running average lets one drift ping drag the
  // center away and split a single visit into several fake stops.
  const clusters: LocationHistoryPoint[][] = [];
  let current: LocationHistoryPoint[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    const center = {
      latitude: median(current.map((p) => p.latitude)),
      longitude: median(current.map((p) => p.longitude)),
    };
    const dist = haversineMeters(center, { latitude: pt.latitude, longitude: pt.longitude });
    const gap = new Date(pt.createdAt).getTime() - new Date(current[current.length - 1].createdAt).getTime();
    const last = current[current.length - 1];
    const sameDay =
      getJakartaDateOnly(new Date(pt.createdAt)) ===
      getJakartaDateOnly(new Date(last.createdAt));
    const tolerance = toleranceFor(current);
    const sparseTolerance = Math.min(tolerance, Math.max(sparseRadius, tolerance / 2));
    if (
      dist <= tolerance &&
      (gap <= maxGapMs ||
        (dist <= sparseTolerance && gap <= maxSparseGapMs && sameDay))
    ) {
      current.push(pt);
    } else {
      clusters.push(current);
      current = [pt];
    }
  }
  clusters.push(current);

  const stops: VisitedStop[] = [];
  clusters.forEach((cluster, index) => {
    const first = cluster[0];
    const last = cluster[cluster.length - 1];
    const startTime = new Date(first.createdAt).getTime();
    const endTime = new Date(last.createdAt).getTime();
    const dwellMinutes = (endTime - startTime) / 60_000;
    // A null speed is "unknown", not "moving" — many devices omit it entirely.
    const stationaryPings = cluster.filter(
      (p) => p.speed === null || p.speed < 1.0,
    ).length;
    const isCurrent = index === clusters.length - 1;

    // The latest cluster always survives — it represents where the person is now.
    if (!isCurrent && dwellMinutes < minDwellMinutes && stationaryPings < minStationary) {
      return;
    }

    stops.push({
      id: `stop-${first.userId}-${stops.length + 1}-${startTime}`,
      userId: first.userId,
      latitude: median(cluster.map((p) => p.latitude)),
      longitude: median(cluster.map((p) => p.longitude)),
      arrivedAt: first.createdAt,
      departedAt: last.createdAt,
      durationMinutes: Math.max(1, Math.round(dwellMinutes)),
      pointCount: cluster.length,
      isCurrent,
      radiusMeters: toleranceFor(cluster),
    });
  });

  // A brief drift excursion can split one real visit into two nearby stops.
  // Revisiting the same place after a long absence stays a separate visit.
  const merged: VisitedStop[] = [];
  for (const stop of stops) {
    const previous = merged[merged.length - 1];
    if (previous) {
      const dist = haversineMeters(
        { latitude: previous.latitude, longitude: previous.longitude },
        { latitude: stop.latitude, longitude: stop.longitude },
      );
      const gap = new Date(stop.arrivedAt).getTime() - new Date(previous.departedAt).getTime();
      if (dist <= mergeRadius && gap <= maxGapMs) {
        const total = previous.pointCount + stop.pointCount;
        const arrived = new Date(previous.arrivedAt).getTime();
        const departed = new Date(stop.departedAt).getTime();
        merged[merged.length - 1] = {
          ...previous,
          latitude: (previous.latitude * previous.pointCount + stop.latitude * stop.pointCount) / total,
          longitude: (previous.longitude * previous.pointCount + stop.longitude * stop.pointCount) / total,
          departedAt: stop.departedAt,
          durationMinutes: Math.max(1, Math.round((departed - arrived) / 60_000)),
          pointCount: total,
          isCurrent: stop.isCurrent,
          radiusMeters: Math.max(previous.radiusMeters ?? 50, stop.radiusMeters ?? 50),
        };
        continue;
      }
    }
    merged.push(stop);
  }

  return merged;
}

/**
 * Split a trail where the data has a hole.
 *
 * A single polyline across a 9-hour gap draws a straight line through the city
 * as if the person teleported. Rendering one line per segment leaves the hole
 * visible, which is the truth.
 */
export const TRAIL_GAP_MS = 10 * 60_000;

export function splitTrailSegments<T extends { createdAt: string }>(
  points: T[],
  maxGapMs = TRAIL_GAP_MS,
): T[][] {
  if (!points || points.length === 0) return [];
  const segments: T[][] = [];
  let current: T[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const previous = new Date(points[i - 1].createdAt).getTime();
    const next = new Date(points[i].createdAt).getTime();
    const gap = next - previous;
    if (Number.isFinite(gap) && gap > maxGapMs) {
      segments.push(current);
      current = [points[i]];
    } else {
      current.push(points[i]);
    }
  }

  segments.push(current);
  return segments;
}

/** Downsample waypoints so the routing URL stays concise and performant. */export function downsampleWaypoints(
  points: Array<{ lat: number; lng: number }>,
  minDistanceMeters = 35,
  maxPoints = 40,
): Array<{ lat: number; lng: number }> {
  if (points.length <= 2) return points;

  const result: Array<{ lat: number; lng: number }> = [points[0]];
  let lastAdded = points[0];

  for (let i = 1; i < points.length - 1; i++) {
    const pt = points[i];
    const dist = haversineMeters(
      { latitude: lastAdded.lat, longitude: lastAdded.lng },
      { latitude: pt.lat, longitude: pt.lng },
    );
    if (dist >= minDistanceMeters) {
      result.push(pt);
      lastAdded = pt;
    }
  }

  result.push(points[points.length - 1]);

  if (result.length > maxPoints) {
    const step = (result.length - 1) / (maxPoints - 1);
    const sampled: Array<{ lat: number; lng: number }> = [];
    for (let i = 0; i < maxPoints; i++) {
      const idx = Math.min(result.length - 1, Math.round(i * step));
      sampled.push(result[idx]);
    }
    return sampled;
  }

  return result;
}

/**
 * Road-snapped geometry for a history trail. Goes through our own API proxy;
 * returns the straight (downsampled) points on any failure.
 */
export async function fetchRoadSnappedRoute(
  points: Array<{ lat: number; lng: number }>,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<Array<[number, number]>> {
  if (points.length < 2) return points.map((p) => [p.lat, p.lng]);

  const waypoints = downsampleWaypoints(points);
  if (waypoints.length < 2) return points.map((p) => [p.lat, p.lng]);

  const route = await fetchRoadRoute(waypoints[0], waypoints[waypoints.length - 1], {
    signal: options.signal,
    via: waypoints.slice(1, -1),
  });
  if (route.geometry && route.geometry.length >= 2) return route.geometry;
  return downsampleWaypoints(points).map((p) => [p.lat, p.lng]);
}
