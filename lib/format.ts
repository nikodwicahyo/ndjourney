/**
 * Single home for tiny formatting / array helpers.
 * Reuse from here instead of redefining per-component.
 */
// ponytail: canonical versions; local dupes should import from here.
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

export type PublicUser = { id: string; name: string | null; image: string | null };

// ponytail: public endpoints must never leak emails — strip to display fields.
// Lives here (not batch.ts) so it stays importable without a DB client.
export function toPublicUser(
  u: { id: string; name: string | null; image: string | null; email?: string | null } | null | undefined,
): PublicUser | null {
  if (!u) return null;
  return { id: u.id, name: u.name, image: u.image };
}
