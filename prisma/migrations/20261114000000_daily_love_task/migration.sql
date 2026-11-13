-- Per-user daily love task ledger.
--
-- One row per user per Jakarta calendar day. `task` is validated against the
-- shared bank in lib/daily-love-task.ts, `done` is the completion flag, and the
-- streak/history read model is derived from these rows (no separate counter to
-- drift). Idempotent so a re-run after a partial deploy is safe.

CREATE TABLE IF NOT EXISTS "DailyLoveTaskEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "task" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyLoveTaskEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyLoveTaskEntry_userId_date_key"
    ON "DailyLoveTaskEntry"("userId", "date");

CREATE INDEX IF NOT EXISTS "DailyLoveTaskEntry_userId_date_done_idx"
    ON "DailyLoveTaskEntry"("userId", "date", "done");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DailyLoveTaskEntry_userId_fkey'
  ) THEN
    ALTER TABLE "DailyLoveTaskEntry"
      ADD CONSTRAINT "DailyLoveTaskEntry_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
