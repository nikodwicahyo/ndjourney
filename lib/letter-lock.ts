export type LetterLockFields = {
  isTimeCapsule?: boolean | null;
  unlockAt?: string | Date | null;
  isOpened?: boolean | null;
};

/**
 * Canonical time-capsule lock rule — the API 423 guard, SSR hydration, list
 * card and viewer must all agree on this one predicate.
 *
 * A letter is locked only when it IS a time capsule, its unlock time is in the
 * future, and it has not been opened. Missing content is NOT a lock signal.
 */
export function isLetterLocked(
  letter: LetterLockFields,
  now: number = Date.now(),
): boolean {
  if (!letter.isTimeCapsule || letter.isOpened || !letter.unlockAt) return false;

  const unlockMs =
    letter.unlockAt instanceof Date
      ? letter.unlockAt.getTime()
      : new Date(letter.unlockAt).getTime();

  return Number.isFinite(unlockMs) && unlockMs > now;
}
