-- Performance indexes for hot filters (see audit batch 1).
-- All additive (CREATE INDEX IF NOT EXISTS); safe to apply online.

CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "Photo_coupleId_createdAt_idx" ON "Photo"("coupleId", "createdAt");
CREATE INDEX IF NOT EXISTS "Photo_milestone_video_createdAt_idx" ON "Photo"("isMilestoneOnly", "isVideo", "createdAt");
CREATE INDEX IF NOT EXISTS "Letter_coupleId_idx" ON "Letter"("coupleId");
CREATE INDEX IF NOT EXISTS "Letter_timecapsule_notify_idx" ON "Letter"("isTimeCapsule", "isOpened", "notificationSentAt", "unlockAt");
CREATE INDEX IF NOT EXISTS "DailyNote_coupleId_date_idx" ON "DailyNote"("coupleId", "date");

-- Dedup guard for double-submitted answers (NULL userIds stay distinct in Postgres).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GameScore_userId_questionId_key') THEN
    ALTER TABLE "GameScore" ADD CONSTRAINT "GameScore_userId_questionId_key" UNIQUE ("userId", "questionId");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "GameScore_playerName_questionId_idx" ON "GameScore"("playerName", "questionId");
