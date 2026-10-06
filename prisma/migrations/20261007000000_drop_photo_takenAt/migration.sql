-- Drop takenAt (redundant with createdAt; year filter now reads createdAt)
DROP INDEX IF EXISTS "Photo_takenAt_idx";
ALTER TABLE "Photo" DROP COLUMN IF EXISTS "takenAt";
