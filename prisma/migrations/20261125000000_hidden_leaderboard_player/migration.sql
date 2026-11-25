-- Leaderboard moderation list.
--
-- The board is aggregated from the append-only ledgers ("GameRound" /
-- "GameArcadeScore"), so hiding a player must never touch those rows: it only
-- filters the aggregate. That keeps the history intact and the action
-- reversible from the dashboard.
--
-- "playerKey" is `user:<userId>` for accounts and `guest:<lowercased name>`
-- for guests (guests have no id). The query builds the same keys inline.
-- Idempotent on purpose: safe to re-run.

CREATE TABLE IF NOT EXISTS "HiddenLeaderboardPlayer" (
    "id" TEXT NOT NULL,
    "playerKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hiddenBy" TEXT,
    "hiddenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiddenLeaderboardPlayer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HiddenLeaderboardPlayer_playerKey_key"
    ON "HiddenLeaderboardPlayer"("playerKey");
