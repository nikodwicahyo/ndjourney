/**
 * Single home for tiny formatting / array helpers.
 * Reuse from here instead of redefining per-component.
 */
// canonical versions; local dupes should import from here.
export { formatBytes, formatRelativeTime as timeAgo, truncate } from "./utils";

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Accuracy label shared by PartnerMap + DistanceCard (same thresholds). */
export function accuracyLabel(accuracy: number | null | undefined): string {
  if (accuracy == null) return "Akurasi tidak diketahui";
  if (accuracy <= 10) return "Sangat akurat";
  if (accuracy <= 30) return "Akurat";
  if (accuracy <= 65) return "Cukup akurat";
  if (accuracy <= 150) return "Kurang akurat";
  return "Tidak akurat";
}

/** Safe JSON.parse wrapper for localStorage payloads. */
export function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadLocal<T>(key: string, fallback: T): T {
  try {
    return safeParse(localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

export function saveLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota / private-mode: non-fatal
  }
}

const TRUSTED_AVATAR_HOSTS =
  /^https:\/\/(res\.cloudinary\.com|lh3\.googleusercontent\.com|avatars\.githubusercontent\.com)\//;

/**
 * Avatar URL safe to interpolate into an HTML attribute.
 *
 * Leaflet renders divIcon/marker HTML through `innerHTML`, so a caller-
 * controlled avatar URL must be both host-allowlisted and attribute-escaped.
 */
export function safeAvatarSrc(url: string | null | undefined): string | null {
  if (!url || !TRUSTED_AVATAR_HOSTS.test(url)) return null;
  try {
    if (new URL(url).protocol !== "https:") return null;
  } catch {
    return null;
  }
  return url.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

export type PublicUser = { id: string; name: string | null; image: string | null };

// public endpoints must never leak emails — strip to display fields.
// Lives here (not batch.ts) so it stays importable without a DB client.
export function toPublicUser(
  u: { id: string; name: string | null; image: string | null; email?: string | null } | null | undefined,
): PublicUser | null {
  if (!u) return null;
  return { id: u.id, name: u.name, image: u.image };
}
