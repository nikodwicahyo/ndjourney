-- Couple split-brain guard (P1).
-- The app supports exactly one couple (quota = 2 PARTNERs, singleton
-- CoupleConfig), but nothing stopped concurrent ensureCouple() calls from
-- each creating a Couple row and partitioning the partners.
--
-- 1. Repair: if split rows already exist, fold them into one survivor
--    (most members, tie -> oldest). Members are distinct users (userId is
--    globally unique) so reassignment cannot conflict; content FKs are
--    nullable with NoAction, so repoint before deleting. No-op on healthy
--    DBs (0-1 couples). Valid relationships are preserved, nothing is
--    dropped except empty duplicate Couple rows.
-- 2. Enforce: unique singleton allows at most one Couple row ever. Any
--    future bypass of the advisory lock in ensureCouple() fails loudly
--    with P2002 (handled as rejoin-the-winner) instead of splitting.

DO $$
DECLARE
  survivor TEXT;
BEGIN
  IF (SELECT COUNT(*) FROM "Couple") <= 1 THEN
    RETURN;
  END IF;

  SELECT c."id" INTO survivor
  FROM "Couple" c
  LEFT JOIN "CoupleMember" m ON m."coupleId" = c."id"
  GROUP BY c."id"
  ORDER BY COUNT(m."id") DESC, MIN(c."createdAt") ASC
  LIMIT 1;

  UPDATE "DailyNote" SET "coupleId" = survivor WHERE "coupleId" IS NOT NULL AND "coupleId" <> survivor;
  UPDATE "Letter" SET "coupleId" = survivor WHERE "coupleId" IS NOT NULL AND "coupleId" <> survivor;
  UPDATE "Milestone" SET "coupleId" = survivor WHERE "coupleId" IS NOT NULL AND "coupleId" <> survivor;
  UPDATE "Photo" SET "coupleId" = survivor WHERE "coupleId" IS NOT NULL AND "coupleId" <> survivor;
  UPDATE "WishItem" SET "coupleId" = survivor WHERE "coupleId" IS NOT NULL AND "coupleId" <> survivor;
  UPDATE "Album" SET "coupleId" = survivor WHERE "coupleId" IS NOT NULL AND "coupleId" <> survivor;
  UPDATE "LocationShare" SET "coupleId" = survivor WHERE "coupleId" IS NOT NULL AND "coupleId" <> survivor;
  UPDATE "UserLocation" SET "coupleId" = survivor WHERE "coupleId" IS NOT NULL AND "coupleId" <> survivor;
  UPDATE "UserLocationHistory" SET "coupleId" = survivor WHERE "coupleId" IS NOT NULL AND "coupleId" <> survivor;

  UPDATE "CoupleMember" SET "coupleId" = survivor WHERE "coupleId" <> survivor;

  DELETE FROM "Couple" WHERE "id" <> survivor;
END $$;

ALTER TABLE "Couple" ADD COLUMN IF NOT EXISTS "singleton" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS "Couple_singleton_key" ON "Couple"("singleton");
