-- Phase 10: review moderation (hide/restore), the admin contact inbox and
-- deposit claim decisions.
-- Additive only.


-- AlterTable
ALTER TABLE "contact_messages" ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "repliedAt" TIMESTAMP(3),
ADD COLUMN     "replyBody" TEXT;

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "reviews_isHidden_idx" ON "reviews"("isHidden");

-- Deposit claims settled by an admin.
ALTER TYPE "DepositStatus" ADD VALUE 'KEPT';
ALTER TABLE "rental_orders" ADD COLUMN "claimResolvedAt" TIMESTAMP(3),
ADD COLUMN "claimKeptAmount" DECIMAL(10,2),
ADD COLUMN "claimResolutionNote" TEXT;
