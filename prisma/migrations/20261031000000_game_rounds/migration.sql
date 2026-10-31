-- Completed quiz-round ledger.
--
-- GameScore is a per-answer ledger (`@@unique([userId, questionId])`), so it can
-- only ever answer "how many distinct questions has this user answered". The
-- leaderboard was presenting that count as "x main". This table records one row
-- per FINISHED quiz round, which is what the per-game tabs and the merged
-- "Semua" tab aggregate.
--
-- `correct` is derived server-side from GameScore when the round is submitted;
-- `totalQuestions` is the batch size actually served (not always 10 when the
-- bank is near exhaustion).
--
-- Idempotent on purpose: table creation and the backfill are safe to re-run.

CREATE TABLE IF NOT EXISTS "GameRound" (
    "id" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL,
    "userId" TEXT,
    "playerName" TEXT,
    "correct" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameRound_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GameRound_dedupeKey_key" ON "GameRound"("dedupeKey");
CREATE INDEX IF NOT EXISTS "GameRound_userId_idx" ON "GameRound"("userId");
CREATE INDEX IF NOT EXISTS "GameRound_gameType_idx" ON "GameRound"("gameType");
CREATE INDEX IF NOT EXISTS "GameRound_gameType_playedAt_idx" ON "GameRound"("gameType", "playedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GameRound_userId_fkey') THEN
    ALTER TABLE "GameRound"
      ADD CONSTRAINT "GameRound_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill (approximate, one-time): reconstruct historical rounds from the
-- answer ledger.
--   * a gap of more than 15 minutes between two answers starts a new round;
--   * a round holds at most 10 answers (back-to-back rounds are therefore
--     split correctly even though their timestamps are only seconds apart);
--   * aggregate accuracy is exact afterwards (correct answers / answers given);
--     only the round COUNT is a reconstruction, since the original batches were
--     never persisted.
-- Scoped to the two scored quiz types. Deterministic dedupe keys make a re-run
-- a no-op, and ON CONFLICT protects rows written after the deploy.
WITH src AS (
  SELECT
    gs."id",
    gs."userId",
    q."type" AS "gameType",
    gs."isCorrect",
    gs."playedAt"
  FROM "GameScore" gs
  JOIN "GameQuestion" q ON q."id" = gs."questionId"
  WHERE gs."userId" IS NOT NULL
    AND q."type" IN ('WOULD_YOU_RATHER', 'TRIVIA')
),
flagged AS (
  SELECT
    s.*,
    CASE
      WHEN LAG(s."playedAt") OVER (
             PARTITION BY s."userId", s."gameType" ORDER BY s."playedAt", s."id"
           ) IS NULL
        OR s."playedAt" > LAG(s."playedAt") OVER (
             PARTITION BY s."userId", s."gameType" ORDER BY s."playedAt", s."id"
           ) + interval '15 minutes'
      THEN 1 ELSE 0
    END AS "isNewSession"
  FROM src s
),
sessioned AS (
  SELECT
    f.*,
    SUM(f."isNewSession") OVER (
      PARTITION BY f."userId", f."gameType"
      ORDER BY f."playedAt", f."id"
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS "sessionNo"
  FROM flagged f
),
numbered AS (
  SELECT
    s.*,
    ROW_NUMBER() OVER (
      PARTITION BY s."userId", s."gameType", s."sessionNo"
      ORDER BY s."playedAt", s."id"
    ) AS "rn"
  FROM sessioned s
),
grouped AS (
  SELECT
    "userId",
    "gameType",
    "sessionNo",
    ((("rn" - 1) / 10) + 1) AS "bucket",
    MIN("playedAt") AS "startedAt",
    COUNT(*)::int AS "totalQuestions",
    SUM(CASE WHEN "isCorrect" THEN 1 ELSE 0 END)::int AS "correct"
  FROM numbered
  GROUP BY "userId", "gameType", "sessionNo", "bucket"
)
INSERT INTO "GameRound" (
  "id", "gameType", "userId", "playerName", "correct", "totalQuestions", "dedupeKey", "playedAt"
)
SELECT
  'backfill_' || md5(g."userId" || ':' || g."gameType"::text || ':' || g."sessionNo" || ':' || g."bucket"),
  g."gameType",
  g."userId",
  NULL,
  g."correct",
  g."totalQuestions",
  'backfill:' || g."userId" || ':' || g."gameType"::text || ':' || g."sessionNo" || ':' || g."bucket",
  g."startedAt"
FROM grouped g
ON CONFLICT ("dedupeKey") DO NOTHING;
