-- Backfill coupleId on existing photos that are missing it.
-- Links each photo to the couple of the user who uploaded it.
UPDATE "Photo" p
SET "coupleId" = cm."coupleId"
FROM "CoupleMember" cm
WHERE p."coupleId" IS NULL
  AND p."uploadedById" = cm."userId";
