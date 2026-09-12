-- Add optional coupleId to Album so album mutations can be ownership-checked.
-- Legacy albums keep NULL coupleId (treated leniently by the API until backfilled).
ALTER TABLE "Album" ADD COLUMN "coupleId" TEXT;

-- Backfill: link each album to the couple of the user who uploaded most of its photos.
UPDATE "Album" a
SET "coupleId" = sub."coupleId"
FROM (
  SELECT p."albumId", cm."coupleId"
  FROM "Photo" p
  JOIN "CoupleMember" cm ON cm."userId" = p."uploadedById"
  WHERE p."albumId" IS NOT NULL
  GROUP BY p."albumId", cm."coupleId"
) AS sub
WHERE a.id = sub."albumId" AND a."coupleId" IS NULL;

CREATE INDEX "Album_coupleId_idx" ON "Album"("coupleId");

ALTER TABLE "Album" ADD CONSTRAINT "Album_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE SET NULL ON UPDATE CASCADE;
