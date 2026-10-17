-- Booking engine: date-range availability, order lifecycle deadlines,
-- one provider per order, deposits and refunds.
--
-- Data repair: until now `gear_items.stock` was decremented when an order was
-- placed, restored only on customer cancellation, and never restored on
-- return. From this migration on, `stock` means *units owned* and availability
-- is computed from overlapping bookings, so the units still subtracted for
-- PLACED, CONFIRMED, PAID, PICKED_UP and RETURNED orders are added back.

-- All or nothing: a failure half-way must not leave stock half-repaired.
BEGIN;

-- CreateEnum
CREATE TYPE "CancelReason" AS ENUM ('CUSTOMER', 'PROVIDER_DECLINED', 'PAYMENT_EXPIRED', 'NO_PROVIDER_RESPONSE', 'ADMIN');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('NONE', 'HELD', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CLAIMED');

-- AlterTable
ALTER TABLE "gear_items" ADD COLUMN     "depositAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "refundedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "stripePaymentIntentId" TEXT;

-- AlterTable ("providerId" starts nullable so existing rows can be backfilled)
ALTER TABLE "rental_orders" ADD COLUMN     "cancelNote" TEXT,
ADD COLUMN     "cancelReason" "CancelReason",
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "damageClaimAmount" DECIMAL(10,2),
ADD COLUMN     "damageNote" TEXT,
ADD COLUMN     "depositAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "depositStatus" "DepositStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "paymentDueAt" TIMESTAMP(3),
ADD COLUMN     "pickedUpAt" TIMESTAMP(3),
ADD COLUMN     "providerId" TEXT,
ADD COLUMN     "respondBy" TIMESTAMP(3),
ADD COLUMN     "returnedAt" TIMESTAMP(3);

-- Backfill: provider of the order's first item.
UPDATE "rental_orders" AS o
SET "providerId" = sub."providerId"
FROM (
  SELECT DISTINCT ON (oi."rentalOrderId") oi."rentalOrderId", g."providerId"
  FROM "order_items" AS oi
  JOIN "gear_items" AS g ON g."id" = oi."gearItemId"
  ORDER BY oi."rentalOrderId", oi."id"
) AS sub
WHERE o."id" = sub."rentalOrderId";

ALTER TABLE "rental_orders" ALTER COLUMN "providerId" SET NOT NULL;

-- Backfill: give open orders a fresh deadline from today.
UPDATE "rental_orders" SET "respondBy" = NOW() + INTERVAL '48 hours' WHERE "status" = 'PLACED';
UPDATE "rental_orders" SET "paymentDueAt" = NOW() + INTERVAL '24 hours' WHERE "status" = 'CONFIRMED';

-- Backfill: only customers could cancel before this migration.
UPDATE "rental_orders"
SET "cancelledAt" = "updatedAt", "cancelReason" = 'CUSTOMER'
WHERE "status" = 'CANCELLED';

-- Data repair: stock becomes units owned (see header).
UPDATE "gear_items" AS g
SET "stock" = g."stock" + held."quantity"
FROM (
  SELECT oi."gearItemId", SUM(oi."quantity")::int AS "quantity"
  FROM "order_items" AS oi
  JOIN "rental_orders" AS o ON o."id" = oi."rentalOrderId"
  WHERE o."status" IN ('PLACED', 'CONFIRMED', 'PAID', 'PICKED_UP', 'RETURNED')
  GROUP BY oi."gearItemId"
) AS held
WHERE g."id" = held."gearItemId";

-- CreateIndex
CREATE INDEX "rental_orders_providerId_idx" ON "rental_orders"("providerId");

-- CreateIndex
CREATE INDEX "rental_orders_status_startDate_endDate_idx" ON "rental_orders"("status", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "rental_orders" ADD CONSTRAINT "rental_orders_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
