import { LETTER_MOOD_CONFIG, type LetterMood } from "@/types";
import { stripHtml } from "@/lib/utils";

const STORAGE_PREFIX = "letter-draft:";
const STORAGE_VERSION = 1;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type LetterDraft = {
  version: number;
  title: string;
  content: string;
  mood: LetterMood;
  isTimeCapsule: boolean;
  unlockDate: string;
  unlockTime: string;
  savedAt: number;
};

export type LetterDraftFields = Omit<LetterDraft, "version" | "savedAt">;

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function letterDraftKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function isLetterDraftEmpty(
  draft: Pick<LetterDraftFields, "title" | "content">,
): boolean {
  return !draft.title.trim() && !stripHtml(draft.content);
}

function isValidDraft(value: unknown, now: number): value is LetterDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return (
    draft.version === STORAGE_VERSION &&
    typeof draft.title === "string" &&
    typeof draft.content === "string" &&
    typeof draft.mood === "string" &&
    draft.mood in LETTER_MOOD_CONFIG &&
    typeof draft.isTimeCapsule === "boolean" &&
    typeof draft.unlockDate === "string" &&
    typeof draft.unlockTime === "string" &&
    typeof draft.savedAt === "number" &&
    Number.isFinite(draft.savedAt) &&
    now - draft.savedAt < MAX_AGE_MS
  );
}

/** Restore a draft for this user, dropping anything stale or malformed. */
export function loadLetterDraft(
  userId: string,
  now = Date.now(),
): LetterDraft | null {
  const storage = getStorage();
  if (!storage) return null;

  const key = letterDraftKey(userId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isValidDraft(parsed, now)) return parsed;
    storage.removeItem(key);
    return null;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Storage is blocked; nothing more we can do.
    }
    return null;
  }
}

/** Returns the save timestamp, or null when the draft is empty or storage fails. */
export function saveLetterDraft(
  userId: string,
  fields: LetterDraftFields,
): number | null {
  if (isLetterDraftEmpty(fields)) return null;
  const storage = getStorage();
  if (!storage) return null;

  const savedAt = Date.now();
  try {
    storage.setItem(
      letterDraftKey(userId),
      JSON.stringify({ ...fields, version: STORAGE_VERSION, savedAt }),
    );
    return savedAt;
  } catch {
    return null;
  }
}

export function clearLetterDraft(userId: string): void {
  try {
    getStorage()?.removeItem(letterDraftKey(userId));
  } catch {
    // Storage is blocked; nothing to clear.
  }
}
