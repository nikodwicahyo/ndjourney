-- Device time of the fix. Existing rows fall back to the last receipt time,
-- which is the best estimate available for historical data.
ALTER TABLE "UserLocation" ADD COLUMN "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "UserLocation" SET "recordedAt" = "updatedAt";
