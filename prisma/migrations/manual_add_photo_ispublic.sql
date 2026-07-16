/*
  Manual migration: add isPublic column to Photo table.
  Applied directly to the database to preserve existing data
  (the full `migrate dev` would force a destructive reset because
  earlier migrations were not recorded against this database).
*/

ALTER TABLE "Photo" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "Photo_isPublic_idx" ON "Photo"("isPublic");
