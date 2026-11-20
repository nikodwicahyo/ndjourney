export const MEET_THRESHOLD_METERS = 100;

/**
 * A location fix older than this is shown as "Offline" in the UI. The live
 * re-online notification uses the same threshold, so the bell can never claim
 * "online" while the location card says "Offline".
 */
export const LOCATION_STALE_AFTER_SECONDS = 60;

export const WALKING_SPEED_MS = 1.4;
export const CYCLING_SPEED_MS = 8.3;
export const DRIVING_SPEED_MS = 11.1;

const EARTH_RADIUS_M = 6371000;

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);

  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const DIRECTION_NAMES_ID = [
  "Utara", "Timur Laut", "Timur", "Tenggara",
  "Selatan", "Barat Daya", "Barat", "Barat Laut",
] as const;

export function bearing(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const x = Math.sin(dLon) * Math.cos(lat2);
  const y =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return (toDeg(Math.atan2(x, y)) + 360) % 360;
}

export function formatBearing(degrees: number): string {
  if (!Number.isFinite(degrees)) return "";
  const index = bearingIndex(degrees);
  return `${DIRECTION_NAMES_ID[index]} ${Math.round(degrees)}°`;
}

export function formatBearingId(degrees: number): string {
  if (!Number.isFinite(degrees)) return "";
  return DIRECTION_NAMES_ID[bearingIndex(degrees)];
}

function bearingIndex(degrees: number): number {
  return ((Math.round(degrees / 45) % 8) + 8) % 8;
}

type BearingPoint = { lat: number; lng: number };

/**
 * Compass bearing toward the other person, or null only when no direction
 * exists (non-finite coordinates or identical points). Staleness is reported
 * separately in the UI instead of silently hiding the last known direction.
 */
export function reliableBearing(a: BearingPoint, b: BearingPoint): number | null {
  if (![a.lat, a.lng, b.lat, b.lng].every(Number.isFinite)) return null;
  if (a.lat === b.lat && a.lng === b.lng) return null;
  return bearing(
    { latitude: a.lat, longitude: a.lng },
    { latitude: b.lat, longitude: b.lng },
  );
}

const DIRECTION_ARROWS = ["⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️"] as const;

export function directionEmoji(degrees: number): string {
  const index = Math.round(degrees / 45) % 8;
  return DIRECTION_ARROWS[index];
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDistanceCategory(meters: number): string {
  if (meters <= 10) return "Bertemu";
  if (meters <= 20) return "Sangat dekat";
  if (meters <= 50) return "Dekat";
  if (meters <= 100) return "Dalam jangkauan";
  if (meters <= 500) return "Beberapa ratus meter";
  if (meters <= 1000) return "Kurang dari 1 km";
  if (meters <= 15000) return "Satu kota";
  if (meters <= 100_000) return "Antarkota";
  return "Lintas provinsi";
}

export function isMeeting(distanceMeters: number): boolean {
  return distanceMeters <= MEET_THRESHOLD_METERS;
}

export type TravelMode = "walking" | "cycling" | "driving";

/**
 * Road-only ETA. The distance always comes from a real road route — never from
 * a straight line — so the toggle that changes the map view cannot change ETA.
 * Car uses OSRM's own driving duration when available; the other modes scale
 * the same road distance by their realistic speed.
 */
export function estimateRoadArrivalSeconds(
  route: { distanceMeters: number; durationSeconds: number | null } | null | undefined,
  mode: TravelMode = "walking",
): number {
  if (!route) return 0;
  const distance = route.distanceMeters;
  if (!Number.isFinite(distance) || distance <= 0) return 0;
  if (mode === "driving") {
    const duration = route.durationSeconds;
    if (typeof duration === "number" && Number.isFinite(duration) && duration > 0) {
      return Math.round(duration);
    }
  }
  const speed =
    mode === "cycling" ? CYCLING_SPEED_MS
    : mode === "driving" ? DRIVING_SPEED_MS
    : WALKING_SPEED_MS;
  return Math.round(distance / speed);
}

export function formatArrivalTime(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 60) return "<1 menit";
  if (seconds < 3600) return `${Math.round(seconds / 60)} menit`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    if (rh === 0) return `${d} hari`;
    return `${d} hari ${rh} jam`;
  }
  return m > 0 ? `${h} jam ${m} menit` : `${h} jam`;
}

export type DistanceTrend = "closing" | "stable" | "away" | null;

export function distanceTrend(
  currentMeters: number,
  previousMeters: number | null,
): DistanceTrend {
  if (previousMeters === null) return null;
  const diff = currentMeters - previousMeters;
  if (Math.abs(diff) < 10) return "stable";
  if (diff < 0) return "closing";
  return "away";
}
