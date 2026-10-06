-- Folded from manual_add_photo_ispublic.sql (applied by hand on prod to avoid
-- a destructive `migrate dev` reset). Idempotent guards make it safe whether or
-- not the manual file was already applied.
-- After this ships everywhere, manual_add_photo_ispublic.sql can be deleted.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Photo' AND column_name = 'isPublic'
  ) THEN
    ALTER TABLE "Photo" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Photo_isPublic_idx" ON "Photo"("isPublic");
