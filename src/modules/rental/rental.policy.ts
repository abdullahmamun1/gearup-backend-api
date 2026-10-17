import { RentalStatus } from "../../../generated/prisma/enums";
import { RentalOrderWhereInput } from "../../../generated/prisma/models";
import { DAY_MS, HOUR_MS, dayStartsAt, minDate } from "../../utils/dates";

export const RENTAL_POLICY = {
  maxRentalDays: 30,
  maxDaysAhead: 120,
  /** A provider has this long to confirm or decline a new order. */
  respondWithinMs: 48 * HOUR_MS,
  /** A customer has this long to pay once the provider confirms. */
  payWithinMs: 24 * HOUR_MS,
  /**
   * A Stripe session can outlive the due time by up to ~30 minutes (Stripe's
   * minimum session length). Payments that land within this grace still
   * count, so the order keeps holding its units until it ends.
   */
  paymentGraceMs: HOUR_MS,
  /** Paid rentals get a full refund when cancelled at least this early. */
  freeCancellationMs: 24 * HOUR_MS,
} as const;

/** Never later than the end of the start day: no confirming a past rental. */
export const respondByFor = (startDate: Date, now: Date) =>
  minDate(
    new Date(now.getTime() + RENTAL_POLICY.respondWithinMs),
    new Date(dayStartsAt(startDate).getTime() + DAY_MS),
  );

export const paymentDueFor = (startDate: Date, now: Date) =>
  minDate(
    new Date(now.getTime() + RENTAL_POLICY.payWithinMs),
    new Date(dayStartsAt(startDate).getTime() + DAY_MS),
  );

/** Latest moment a PAID order can still be cancelled with a full refund. */
export const freeCancellationUntil = (startDate: Date) =>
  new Date(dayStartsAt(startDate).getTime() - RENTAL_POLICY.freeCancellationMs);

export const isPaymentWindowOpen = (paymentDueAt: Date | null, now: Date) =>
  !!paymentDueAt &&
  paymentDueAt.getTime() + RENTAL_POLICY.paymentGraceMs > now.getTime();

/**
 * Orders that hold units on their dates. Cancelled and returned orders never
 * do, and PLACED / CONFIRMED orders stop the moment their deadline passes —
 * even before the expiry job flips their status.
 */
export const holdsStockWhere = (now: Date): RentalOrderWhereInput => ({
  OR: [
    { status: RentalStatus.PLACED, respondBy: { gt: now } },
    {
      status: RentalStatus.CONFIRMED,
      paymentDueAt: {
        gt: new Date(now.getTime() - RENTAL_POLICY.paymentGraceMs),
      },
    },
    { status: { in: [RentalStatus.PAID, RentalStatus.PICKED_UP] } },
  ],
});
