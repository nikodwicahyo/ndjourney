-- Couple-scoped read indexes (wishlist/timeline/activity filter OR(coupleId, null)).
-- All additive (CREATE INDEX IF NOT EXISTS); safe to apply online.

CREATE INDEX IF NOT EXISTS "Milestone_coupleId_date_idx" ON "Milestone"("coupleId", "date");
CREATE INDEX IF NOT EXISTS "WishItem_coupleId_isDone_createdAt_idx" ON "WishItem"("coupleId", "isDone", "createdAt");
