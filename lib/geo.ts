export const MEET_THRESHOLD_METERS = 100;
// ponytail: distance-based road factor, shorter routes have more turns
function roadFactor(meters: number): number {
  if (meters < 1000) return 1.6;
  if (meters < 5000) return 1.5;
  if (meters < 20000) return 1.4;
  if (meters < 50000) return 1.3;
  return 1.2;
}

// ponytail: time-of-day traffic adjustment, driving only
function trafficMultiplier(): number {
  const h = new Date().getHours();
  if (h >= 22 || h < 5) return 1.3;
  if (h >= 5 && h < 7) return 1.1;
  if (h >= 7 && h < 9) return 0.65;
  if (h >= 17 && h < 20) return 0.6;
  return 0.85;
}
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
  const index = Math.round(degrees / 45) % 8;
  return `${DIRECTION_NAMES_ID[index]} ${Math.round(degrees)}°`;
}

export function formatBearingId(degrees: number): string {
  const index = Math.round(degrees / 45) % 8;
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
  if (meters < 10000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters / 1000)} km`;
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

export function estimateArrivalSeconds(
  distanceMeters: number,
  mode: TravelMode = "walking",
): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return 0;
  const rd = distanceMeters * roadFactor(distanceMeters);
  const base =
    mode === "cycling" ? CYCLING_SPEED_MS
    : mode === "driving" ? DRIVING_SPEED_MS
    : WALKING_SPEED_MS;
  const speed = mode === "driving" ? base * trafficMultiplier() : base;
  return Math.round(rd / speed);
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
