export const MEET_THRESHOLD_METERS = 100;
export const WALKING_SPEED_MS = 1.1;
export const CYCLING_SPEED_MS = 8.4;
export const DRIVING_SPEED_MS = 9.1;

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

const DIRECTION_NAMES = [
  "N", "NNE", "NE", "ENE",
  "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW",
  "W", "WNW", "NW", "NNW",
] as const;

const DIRECTION_NAMES_ID = [
  "Utara", "Utara Timur Laut", "Timur Laut", "Timur Timur Laut",
  "Timur", "Timur Tenggara", "Tenggara", "Selatan Tenggara",
  "Selatan", "Selatan Barat Daya", "Barat Daya", "Barat Barat Daya",
  "Barat", "Barat Barat Laut", "Barat Laut", "Utara Barat Laut",
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
  const index = Math.round(degrees / 22.5) % 16;
  const dir = DIRECTION_NAMES[index];
  return `${dir} ${Math.round(degrees)}°`;
}

export function formatBearingId(degrees: number): string {
  const index = Math.round(degrees / 22.5) % 16;
  return DIRECTION_NAMES_ID[index];
}

const DIRECTION_ARROWS = ["⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️"] as const;

export function directionEmoji(degrees: number): string {
  const index = Math.round(degrees / 45) % 8;
  return DIRECTION_ARROWS[index];
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  if (meters < 10000) return `${(meters / 1000).toFixed(2)} km`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function isMeeting(distanceMeters: number): boolean {
  return distanceMeters <= MEET_THRESHOLD_METERS;
}

export type TravelMode = "walking" | "cycling" | "driving";

export function estimateArrivalSeconds(
  distanceMeters: number,
  mode: TravelMode = "walking",
): number {
  const speed =
    mode === "cycling"
      ? CYCLING_SPEED_MS
      : mode === "driving"
        ? DRIVING_SPEED_MS
        : WALKING_SPEED_MS;
  return Math.round(distanceMeters / speed);
}

export function formatArrivalTime(seconds: number): string {
  if (seconds < 60) return "<1 menit";
  if (seconds < 3600) return `${Math.round(seconds / 60)} menit`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h} jam ${m} menit` : `${h} jam`;
}

export type DistanceTrend = "closing" | "stable" | "away" | null;

export function distanceTrend(
  currentMeters: number,
  previousMeters: number | null,
): DistanceTrend {
  if (previousMeters === null) return null;
  const diff = currentMeters - previousMeters;
  if (Math.abs(diff) < 5) return "stable";
  if (diff < 0) return "closing";
  return "away";
}
