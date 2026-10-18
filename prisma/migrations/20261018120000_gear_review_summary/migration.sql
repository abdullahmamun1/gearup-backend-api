-- AI review digest per gear item (Phase 8). Both nullable: items with fewer
-- than three reviews never get one.
ALTER TABLE "gear_items" ADD COLUMN "reviewSummary" JSONB,
ADD COLUMN "reviewSummaryAt" TIMESTAMP(3);
