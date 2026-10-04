-- Add non-destructive hero crop rect ({x,y,w,h} fractions) to CoupleConfig.
-- Additive and nullable; existing rows unaffected (NULL = legacy object-cover rendering).

ALTER TABLE "CoupleConfig" ADD COLUMN IF NOT EXISTS "heroCrop" JSONB;
