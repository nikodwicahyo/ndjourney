import { prisma } from "@/lib/prisma";
import { getCached, setCached, cacheKey } from "@/lib/redis";
import { batchLoadUsers } from "@/lib/batch";

const CACHE_TTL = 120;

type LetterRow = {
  id: string; title: string; content: string; authorId: string; recipientId: string;
  isTimeCapsule: boolean; unlockAt: string | null; isOpened: boolean; openedAt: string | null;
  mood: string; isPublic: boolean; createdAt: string; updatedAt: string;
};

export type LetterDetailResult =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "ok"; data: Record<string, unknown> };

/**
 * Letter detail for its author or recipient.
 * Single source for GET /api/letters/[id] and the dashboard letter page's
 * server-side hydration — both must stay in lockstep.
 *
 * Security rules (do not weaken):
 * - only author/recipient may read (403 otherwise)
 * - locked time capsules expose a PARTIAL payload (no content/recipient) —
 *   the hydrated client state must be that same partial payload
 */
export async function getLetterDetail(userId: string, id: string): Promise<LetterDetailResult> {
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
        isPublic: true,
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
    await setCached(rowK, letter, 60);
  }

  if (letter.recipientId !== userId && letter.authorId !== userId) {
    return { status: "forbidden" };
  }

  const userMap = await batchLoadUsers([letter.authorId, letter.recipientId]);

  const enriched = {
    ...letter,
    author: userMap.get(letter.authorId) ?? null,
    recipient: userMap.get(letter.recipientId) ?? null,
  };

  const isLocked =
    letter.isTimeCapsule &&
    letter.unlockAt !== null &&
    new Date(letter.unlockAt).getTime() > Date.now() &&
    !letter.isOpened;

  const lockBucket = isLocked ? "locked" : "unlocked";
  const cacheK = cacheKey("letters", "detail", userId, lockBucket, id);

  const cached = await getCached<Record<string, unknown>>(cacheK);
  if (cached) {
    return { status: "ok", data: cached };
  }

  if (isLocked) {
    const partial = {
      data: {
        id: enriched.id,
        title: enriched.title,
        isTimeCapsule: true,
        unlockAt: enriched.unlockAt,
        author: enriched.author,
        mood: enriched.mood,
        createdAt: enriched.createdAt,
      },
    };
    await setCached(cacheK, partial, CACHE_TTL);
    return { status: "ok", data: partial };
  }

  const response = { data: enriched };
  await setCached(cacheK, response, CACHE_TTL);
  return { status: "ok", data: response };
}
