-- Authz hardening (multi-couple ready).
--
-- 1. Album/WishItem gain an owner so a solo (not-yet-paired) member's rows can
--    stay private without the "coupleId IS NULL = shared" grant every
--    authenticated user used to get.
-- 2. Orphan rows are attributed to the singleton couple. The app enforces one
--    Couple row (Couple.singleton), and creator-scoped models are only adopted
--    when the creator is actually a member - a stray solo user's rows stay
--    orphaned and keep their uploader/creator-scoped visibility.
-- 3. Letter.isPublic is dropped: it was never honored by any read path (letters
--    are author/recipient-only) and had no UI, so it was a dead privacy control.
--
-- Idempotent on purpose: this DB was kept in sync with `prisma db push`, so the
-- schema objects already exist even though none of these steps ever ran. Every
-- statement below is safe to re-run and the backfills are what attribute legacy
-- rows (including rows that predate the couple) to their couple.

ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "WishItem" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Album_createdById_fkey') THEN
    ALTER TABLE "Album"
      ADD CONSTRAINT "Album_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WishItem_createdById_fkey') THEN
    ALTER TABLE "WishItem"
      ADD CONSTRAINT "WishItem_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Album_createdById_idx" ON "Album"("createdById");
CREATE INDEX IF NOT EXISTS "WishItem_createdById_idx" ON "WishItem"("createdById");

-- Unattributable legacy rows (no couple, no creator) can only belong to the
-- singleton couple - there is nobody else they could belong to. Guarded so a
-- future multi-couple database never cross-adopts them.
DO $$
DECLARE
  singleton TEXT;
BEGIN
  IF (SELECT COUNT(*) FROM "Couple") <> 1 THEN
    RETURN;
  END IF;
  SELECT "id" INTO singleton FROM "Couple" LIMIT 1;
  UPDATE "Album" SET "coupleId" = singleton WHERE "coupleId" IS NULL AND "createdById" IS NULL;
  UPDATE "WishItem" SET "coupleId" = singleton WHERE "coupleId" IS NULL AND "createdById" IS NULL;
END $$;

-- Creator-scoped adoption: only rows authored by a member of the couple.
UPDATE "Album" a SET "coupleId" = c."id"
FROM "Couple" c
JOIN "CoupleMember" cm ON cm."coupleId" = c."id"
WHERE a."coupleId" IS NULL AND a."createdById" = cm."userId";

UPDATE "WishItem" w SET "coupleId" = c."id"
FROM "Couple" c
JOIN "CoupleMember" cm ON cm."coupleId" = c."id"
WHERE w."coupleId" IS NULL AND w."createdById" = cm."userId";

UPDATE "Photo" p SET "coupleId" = c."id"
FROM "Couple" c
JOIN "CoupleMember" cm ON cm."coupleId" = c."id"
WHERE p."coupleId" IS NULL AND p."uploadedById" = cm."userId";

UPDATE "Milestone" ms SET "coupleId" = c."id"
FROM "Couple" c
JOIN "CoupleMember" cm ON cm."coupleId" = c."id"
WHERE ms."coupleId" IS NULL AND ms."createdById" = cm."userId";

UPDATE "DailyNote" n SET "coupleId" = c."id"
FROM "Couple" c
JOIN "CoupleMember" cm ON cm."coupleId" = c."id"
WHERE n."coupleId" IS NULL AND n."authorId" = cm."userId";

UPDATE "Letter" l SET "coupleId" = c."id"
FROM "Couple" c
JOIN "CoupleMember" cm ON cm."coupleId" = c."id"
WHERE l."coupleId" IS NULL AND l."authorId" = cm."userId";

ALTER TABLE "Letter" DROP COLUMN IF EXISTS "isPublic";
