/**
 * Canonical identity for a leaderboard row. The leaderboard aggregates two
 * ledgers whose players are either a signed-in account (`userId`) or a guest
 * typing a display name, so moderation has to key on exactly that.
 *
 * The SQL filter in `lib/queries/games.ts` builds the same `user:` / `guest:`
 * keys inline (it must run in the database, before `LIMIT 50`). Keep the two
 * formats in sync — `tests/unit/leaderboard-key.test.ts` pins this one.
 */
export const HIDDEN_USER_PREFIX = "user:";
export const HIDDEN_GUEST_PREFIX = "guest:";

/**
 * Guests have no id, so the name is the identity. Lowercasing + trimming means
 * "Budi", " budi " and "BUDI" cannot be used to reappear on the board.
 */
export function normalizeGuestName(name: string): string {
  return name.trim().toLowerCase();
}

export function leaderboardPlayerKey(input: {
  userId?: string | null;
  playerName?: string | null;
}): string | null {
  const userId = input.userId?.trim();
  if (userId) return `${HIDDEN_USER_PREFIX}${userId}`;

  const name = input.playerName?.trim();
  if (!name) return null;
  return `${HIDDEN_GUEST_PREFIX}${normalizeGuestName(name)}`;
}
