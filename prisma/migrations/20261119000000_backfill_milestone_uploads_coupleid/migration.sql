-- Backfill coupleId on milestone-uploaded photos (isMilestoneOnly) that were
-- persisted as orphans (coupleId IS NULL). Milestone rows are couple-shared,
-- so their linked photos must be too — an orphan photo can only be re-linked
-- by its uploader, which 400s every save from the partner (e.g. crop + save).
--
-- 1) Prefer the couple of the milestone(s) the photo is linked to.
UPDATE "Photo" p
SET "coupleId" = sub."coupleId"
FROM (
  SELECT mp."photoId", MIN(m."coupleId") AS "coupleId"
  FROM "MilestonePhoto" mp
  JOIN "Milestone" m ON m."id" = mp."milestoneId"
  WHERE m."coupleId" IS NOT NULL
  GROUP BY mp."photoId"
) sub
WHERE p."coupleId" IS NULL
  AND p."isMilestoneOnly" = true
  AND p."id" = sub."photoId";

-- 2) Fallback: couple of the uploader (re-applies the 2026-09 rule for rows
--    created since, e.g. prior to this deploy on milestones that were later
--    deleted).
UPDATE "Photo" p
SET "coupleId" = cm."coupleId"
FROM "CoupleMember" cm
WHERE p."coupleId" IS NULL
  AND p."isMilestoneOnly" = true
  AND p."uploadedById" = cm."userId";
