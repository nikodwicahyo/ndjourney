// Bounded no-repeat deck helpers shared by quiz games.
//
// Contract: a player never sees the same question twice until the whole
// bank is exhausted — then the deck cycles explicitly (with UI notice),
// never by silent recycle. Guests persist in localStorage (server only
// tracks logged-in userIds; guest playerNames collide, so guest exclusion
// stays client-side by design).

/** Cap on ids sent as ?exclude= (URL safety for large banks). */
export const MAX_EXCLUDE_IDS = 200;

/** Append ids to seen, de-duplicated, keeping only the most recent cap. */
export function appendSeen(seen: string[], ids: string[]): string[] {
  if (ids.length === 0) return seen;
  const merged = [...new Set([...seen, ...ids])];
  return merged.length > MAX_EXCLUDE_IDS
    ? merged.slice(-MAX_EXCLUDE_IDS)
    : merged;
}

/** Drop ids that left the bank (deleted/archived questions). */
export function pruneSeen<T>(
  items: T[],
  getId: (item: T) => string,
  validIds: Set<string>,
): T[] {
  return items.filter((item) => validIds.has(getId(item)));
}

/** True when every bank item has been seen (and the bank is non-empty). */
export function isExhausted(seenCount: number, total: number): boolean {
  return total > 0 && seenCount >= total;
}

export function deckStorageKey(type: string): string {
  return `game-deck-seen-${type}`;
}

/** Load persisted seen ids (SSR/private-mode safe, capped). */
export function loadSeenIds(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const ids = parsed.filter(
      (v): v is string => typeof v === "string",
    );
    return ids.length > MAX_EXCLUDE_IDS ? ids.slice(-MAX_EXCLUDE_IDS) : ids;
  } catch {
    return [];
  }
}

/** Persist seen ids (failures are non-fatal: quota, private mode). */
export function saveSeenIds(key: string, ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // ignore — exclusion degrades to in-memory for this session
  }
}
