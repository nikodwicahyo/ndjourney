-- Non-destructive per-usage crop rects ({x,y,w,h} fractions) for milestone
-- photos and wish images. Nullable; existing rows read as "no crop" (legacy
-- rendering). Originals are never copied or modified.

ALTER TABLE "MilestonePhoto" ADD COLUMN IF NOT EXISTS "crop" JSONB;
ALTER TABLE "WishItem" ADD COLUMN IF NOT EXISTS "imageCrop" JSONB;
