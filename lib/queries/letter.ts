import { prisma } from "@/lib/prisma";
import { getCached, setCached, cacheKey } from "@/lib/redis";
import { batchLoadUsers } from "@/lib/batch";
import { isLetterLocked } from "@/lib/letter-lock";

const ROW_TTL = 60;
const DETAIL_TTL = 120;
// Bump when the cached payload shape changes. Older entries would otherwise be
// served under the same key (and hydrated as if they were the current shape).
const CACHE_VERSION = "v2";

type LetterRow = {
  id: string; title: string; content: string; authorId: string; recipientId: string;
  isTimeCapsule: boolean; unlockAt: string | null; isOpened: boolean; openedAt: string | null;
  mood: string; createdAt: string; updatedAt: string;
};

type LetterUser = { id: string; name: string | null; image: string | null };

/** Full payload for an unlocked letter (author or recipient). */
export type LetterDetail = LetterRow & {
  author: LetterUser | null;
  recipient: LetterUser | null;
};

/** Partial payload for a locked capsule — no content, no recipient. */
export type LockedLetterDetail = {
  id: string;
  title: string;
  isTimeCapsule: true;
  unlockAt: string;
  isOpened: false;
  author: LetterUser | null;
  mood: string;
  createdAt: string;
};

/**
 * The exact JSON body of GET /api/letters/[id] and the value hydrated into the
 * dashboard page's react-query cache. Both callers MUST use this shape — the
 * envelope `{ data: ... }` belongs to the HTTP layer only.
 */
export type LetterDetailPayload = LetterDetail | LockedLetterDetail;

export type LetterDetailResult =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "ok"; data: LetterDetailPayload };

function secondsUntilUnlock(unlockAt: string | null, now: number): number | null {
  if (!unlockAt) return null;
  const unlockMs = new Date(unlockAt).getTime();
  if (!Number.isFinite(unlockMs) || unlockMs <= now) return null;
  return Math.max(1, Math.ceil((unlockMs - now) / 1000));
}

/**
 * Letter detail for its author or recipient.
 * Single source for GET /api/letters/[id] and the dashboard letter page's
 * server-side hydration — both must stay in lockstep.
 *
 * Security rules (do not weaken):
 * - only author/recipient may read (403 otherwise)
 * - locked time capsules expose a PARTIAL payload (no content/recipient)
 */
export async function getLetterDetail(userId: string, id: string): Promise<LetterDetailResult> {
  const now = Date.now();

  // row cache first — cache-hit path was 2 PG (findUnique + users).
  // Key lives under letters:* so existing PUT/DELETE/open wipes invalidate it.
  const rowK = cacheKey("letters", "row", id);
  let letter = await getCached<LetterRow>(rowK);
  if (!letter) {
    const row = await prisma.letter.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        content: true,
        authorId: true,
        recipientId: true,
        isTimeCapsule: true,
        unlockAt: true,
        isOpened: true,
        openedAt: true,
        mood: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!row) {
      return { status: "not_found" };
    }
    letter = {
      ...row,
      unlockAt: row.unlockAt?.toISOString() ?? null,
      openedAt: row.openedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
    // Never keep a capsule's "still locked" row past its unlock instant, or the
    // lock bucket would stay stale for the rest of the TTL.
    const rowTtl = letter.isOpened
      ? ROW_TTL
      : Math.min(ROW_TTL, secondsUntilUnlock(letter.unlockAt, now) ?? ROW_TTL);
    await setCached(rowK, letter, rowTtl);
  }

  if (letter.recipientId !== userId && letter.authorId !== userId) {
    return { status: "forbidden" };
  }

  const userMap = await batchLoadUsers([letter.authorId, letter.recipientId]);

  const isLocked = isLetterLocked(letter, now);
  const lockBucket = isLocked ? "locked" : "unlocked";
  const cacheK = cacheKey("letters", "detail", CACHE_VERSION, userId, lockBucket, id);

  const cached = await getCached<LetterDetailPayload>(cacheK);
  if (cached) {
    return { status: "ok", data: cached };
  }

  let payload: LetterDetailPayload;

  if (isLocked && letter.unlockAt) {
    payload = {
      id: letter.id,
      title: letter.title,
      isTimeCapsule: true,
      unlockAt: letter.unlockAt,
      isOpened: false,
      author: userMap.get(letter.authorId) ?? null,
      mood: letter.mood,
      createdAt: letter.createdAt,
    };
  } else {
    payload = {
      ...letter,
      author: userMap.get(letter.authorId) ?? null,
      recipient: userMap.get(letter.recipientId) ?? null,
    };
  }

  const detailTtl = isLocked
    ? Math.min(DETAIL_TTL, secondsUntilUnlock(letter.unlockAt, now) ?? DETAIL_TTL)
    : DETAIL_TTL;
  await setCached(cacheK, payload, detailTtl);

  return { status: "ok", data: payload };
}
