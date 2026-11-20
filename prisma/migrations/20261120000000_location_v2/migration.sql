-- Live Location v2: heartbeat/expiry on the share, idempotency on the trail.
-- Everything is additive + nullable: the previous code keeps working until the
-- new server routes deploy (schema -> server -> web -> native).

ALTER TABLE "LocationShare"
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trackingState" TEXT;

CREATE INDEX IF NOT EXISTS "LocationShare_expiresAt_idx" ON "LocationShare"("expiresAt");

ALTER TABLE "UserLocationHistory"
  ADD COLUMN IF NOT EXISTS "clientId" TEXT,
  ADD COLUMN IF NOT EXISTS "recordedAt" TIMESTAMP(3);

-- NULL clientId rows (all legacy data) are not considered duplicates by
-- Postgres, so backfilled history is unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS "UserLocationHistory_userId_clientId_key"
  ON "UserLocationHistory"("userId", "clientId");
CREATE INDEX IF NOT EXISTS "UserLocationHistory_userId_recordedAt_idx"
  ON "UserLocationHistory"("userId", "recordedAt");
