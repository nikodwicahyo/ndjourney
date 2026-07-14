-- Migration for adding isArchived column to GameQuestion table
ALTER TABLE "GameQuestion" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- Create index on isArchived for faster queries
CREATE INDEX "GameQuestion_isArchived_idx" ON "GameQuestion"("isArchived");
