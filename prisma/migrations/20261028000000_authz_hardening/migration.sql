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

ALTER TABLE "Album" ADD COLUMN "createdById" TEXT;
ALTER TABLE "WishItem" ADD COLUMN "createdById" TEXT;

ALTER TABLE "Album"
  ADD CONSTRAINT "Album_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WishItem"
  ADD CONSTRAINT "WishItem_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Album_createdById_idx" ON "Album"("createdById");
CREATE INDEX "WishItem_createdById_idx" ON "WishItem"("createdById");

-- No creator column on these two: under the singleton-couple invariant every
-- orphan row belongs to that couple.
UPDATE "Album" a SET "coupleId" = c."id" FROM "Couple" c WHERE a."coupleId" IS NULL;
UPDATE "WishItem" w SET "coupleId" = c."id" FROM "Couple" c WHERE w."coupleId" IS NULL;

-- Creator-scoped adoption: only rows authored by a member of the couple.
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

ALTER TABLE "Letter" DROP COLUMN "isPublic";
