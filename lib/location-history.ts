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
    // Canonical Jakarta HH:mm via the shared helper — toLocaleTimeString with
    // the id-ID locale renders "15.30", which is NOT the format we standardize on.
    return formatJakartaTime(d);
  } catch {
    return "—";
  }
}

/** One canonical "time range . date" label, shared by the stop list and map popup. */
export function formatStopTimeLabel(stop: VisitedStop): string {
  // Real span only: arrived → last known ping. No "Sekarang" — the GPS may be
  // off, and a wall-clock "now" would be a lie.
  const time = `${formatJakartaTime(stop.arrivedAt)} - ${formatJakartaTime(stop.departedAt)}`;
  const date = formatInJakarta(stop.arrivedAt, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${time} · ${date}`;
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
  const maxAccuracy = options.maxAccuracyMeters ?? 80;
  const minStationary = options.minStationaryPings ?? 3;
  const maxGapMs = (options.maxGapMinutes ?? 15) * 60_000;
  const mergeRadius = options.mergeRadiusMeters ?? 50;
  // A silence at nearly the same spot is usually sparse GPS, not a new visit.
  // Bound it in BOTH directions: a long same-day sleep at one place stays one
  // visit, while fixes on different Jakarta days are separate visits even when
  // the place (and the elapsed time) is identical.
  const sparseRadius = 25;
  const maxSparseGapMs = 6 * 60 * 60_000;

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
    if (
      dist <= clusterRadius &&
      (gap <= maxGapMs ||
        (dist <= sparseRadius && gap <= maxSparseGapMs && sameDay))
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
    const stationaryPings = cluster.filter(
      (p) => p.speed !== null && p.speed < 1.0,
    ).length;
    const isCurrent = index === clusters.length - 1;

    // The latest cluster always survives — it represents where the person is now.
    if (!isCurrent && dwellMinutes < minDwellMinutes && stationaryPings < minStationary) {
      return;
    }

    stops.push({
      // Stable identity: never include the ordinal. When an older stop rolls
      // out of the window, later stops keep their ids and selection survives.
      id: `stop-${first.userId}-${startTime}`,
      userId: first.userId,
      latitude: median(cluster.map((p) => p.latitude)),
      longitude: median(cluster.map((p) => p.longitude)),
      arrivedAt: first.createdAt,
      departedAt: last.createdAt,
      durationMinutes: Math.max(1, Math.round(dwellMinutes)),
      pointCount: cluster.length,
      isCurrent,
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
        };
        continue;
      }
    }
    merged.push(stop);
  }

  return merged;
}

/** Downsample waypoints so the routing URL stays concise and performant. */
export function downsampleWaypoints(
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

  // Combine the caller's cancellation with a hard timeout. The declared
  // timeoutMs used to be a no-op, so a hung OSRM call blocked the trail.
  const controller = new AbortController();
  const timer = options.timeoutMs
    ? setTimeout(() => controller.abort(), options.timeoutMs)
    : null;
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const route = await fetchRoadRoute(waypoints[0], waypoints[waypoints.length - 1], {
      signal: controller.signal,
      via: waypoints.slice(1, -1),
    });
    if (route.geometry && route.geometry.length >= 2) return route.geometry;
    return waypoints.map((p) => [p.lat, p.lng]);
  } finally {
    if (timer) clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Project a raw GPS point onto the closest point on a polyline (road geometry).
 * Clamps within a reasonable distance (e.g. 60m) so genuine off-road positions
 * are not artificially warped far away.
 */
export function projectPointToPolyline(
  point: [number, number],
  polyline: Array<[number, number]>,
  maxDistanceMeters = 60,
): [number, number] {
  if (!polyline || polyline.length === 0) return point;
  if (polyline.length === 1) return polyline[0];

  const pLat = point[0];
  const pLng = point[1];
  let minDistance = Infinity;
  let bestPoint: [number, number] = point;

  for (let i = 0; i < polyline.length - 1; i++) {
    const aLat = polyline[i][0];
    const aLng = polyline[i][1];
    const bLat = polyline[i + 1][0];
    const bLng = polyline[i + 1][1];

    const meanLatRad = ((aLat + bLat) / 2) * (Math.PI / 180);
    const cosMeanLat = Math.cos(meanLatRad);

    const dx = (bLng - aLng) * cosMeanLat * 111320;
    const dy = (bLat - aLat) * 111320;
    const px = (pLng - aLng) * cosMeanLat * 111320;
    const py = (pLat - aLat) * 111320;

    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq > 0.001) {
      t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
    }

    const projLat = aLat + t * (bLat - aLat);
    const projLng = aLng + t * (bLng - aLng);

    const distMeters = haversineMeters(
      { latitude: pLat, longitude: pLng },
      { latitude: projLat, longitude: projLng },
    );

    if (distMeters < minDistance) {
      minDistance = distMeters;
      bestPoint = [projLat, projLng];
    }
  }

  if (minDistance <= maxDistanceMeters) {
    return bestPoint;
  }
  return point;
}
