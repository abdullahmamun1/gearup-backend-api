import Stripe from "stripe";
import {
  CancelReason,
  DepositStatus,
  PaymentStatus,
  RentalStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
import { createError } from "../../utils/createError";
import { isPaymentWindowOpen } from "../rental/rental.policy";

/** BDT is a two-decimal currency in Stripe: amounts are sent in poisha. */
export const toStripeAmount = (amount: number) => Math.round(amount * 100);

const intentIdOf = (
  intent: string | Stripe.PaymentIntent | null | undefined,
) => (typeof intent === "string" ? intent : (intent?.id ?? null));

/** Older payments only stored the checkout session id. */
const resolvePaymentIntent = async (payment: {
  transactionId: string;
  stripePaymentIntentId: string | null;
}) => {
  if (payment.stripePaymentIntentId) return payment.stripePaymentIntentId;
  try {
    const session = await stripe.checkout.sessions.retrieve(
      payment.transactionId,
    );
    return intentIdOf(session.payment_intent);
  } catch {
    return null;
  }
};

/**
 * Refunds part or all of a completed payment.
 *
 * The idempotency key makes a retry (say, after the database write that
 * follows fails) return the same refund instead of paying out twice.
 */
const refundPayment = async (
  payment: { transactionId: string; stripePaymentIntentId: string | null },
  amount: number,
  idempotencyKey: string,
) => {
  if (amount <= 0) return null;

  const paymentIntent = await resolvePaymentIntent(payment);
  if (!paymentIntent) {
    throw createError(
      502,
      "We couldn't find the original card payment to refund. Please contact support.",
    );
  }

  try {
    return await stripe.refunds.create(
      { payment_intent: paymentIntent, amount: toStripeAmount(amount) },
      { idempotencyKey },
    );
  } catch {
    throw createError(
      502,
      "The refund couldn't be processed right now. Please try again shortly.",
    );
  }
};

/** Best effort: stop an abandoned checkout from being paid later. */
const expireOpenSessions = async (rentalOrderId: string) => {
  const pending = await prisma.payment.findMany({
    where: { rentalOrderId, status: PaymentStatus.PENDING },
  });
  for (const payment of pending) {
    try {
      await stripe.checkout.sessions.expire(payment.transactionId);
    } catch {
      // Already expired or completed — the webhook settles it either way.
    }
  }
  await prisma.payment.updateMany({
    where: { rentalOrderId, status: PaymentStatus.PENDING },
    data: { status: PaymentStatus.FAILED },
  });
};

const handleSessionCompleted = async (session: Stripe.Checkout.Session) => {
  const payment = await prisma.payment.findUnique({
    where: { transactionId: session.id },
    include: { rentalOrder: true },
  });
  // Stripe retries webhooks, so an already-settled payment is a no-op.
  if (!payment || payment.status === PaymentStatus.COMPLETED) return;

  const now = new Date();
  const paymentIntentId = intentIdOf(session.payment_intent);
  const order = payment.rentalOrder;
  const deposit = Number(order.depositAmount);

  if (isPaymentWindowOpen(order.paymentDueAt, now)) {
    const settled = await prisma.$transaction(async (tx) => {
      const updated = await tx.rentalOrder.updateMany({
        where: { id: order.id, status: RentalStatus.CONFIRMED },
        data: {
          status: RentalStatus.PAID,
          depositStatus: deposit > 0 ? DepositStatus.HELD : DepositStatus.NONE,
        },
      });
      if (updated.count === 0) return false;

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.COMPLETED,
          paidAt: now,
          stripePaymentIntentId: paymentIntentId,
        },
      });
      return true;
    });
    if (settled) return;
  }

  // Paid too late, or the order was cancelled meanwhile: its units may
  // already be booked by someone else, so give the money back.
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.COMPLETED,
      paidAt: now,
      stripePaymentIntentId: paymentIntentId,
    },
  });
  await refundPayment(
    { transactionId: payment.transactionId, stripePaymentIntentId: paymentIntentId },
    Number(payment.amount),
    `late-payment-refund-${payment.id}`,
  );
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { refundedAmount: payment.amount, refundedAt: new Date() },
    }),
    prisma.rentalOrder.updateMany({
      where: { id: order.id, status: { not: RentalStatus.CANCELLED } },
      data: {
        status: RentalStatus.CANCELLED,
        cancelReason: CancelReason.PAYMENT_EXPIRED,
        cancelledAt: now,
      },
    }),
  ]);
};

const handleSessionExpired = async (session: Stripe.Checkout.Session) => {
  await prisma.payment.updateMany({
    where: { transactionId: session.id, status: PaymentStatus.PENDING },
    data: { status: PaymentStatus.FAILED },
  });
};

/** Keeps refunds issued from the Stripe dashboard in sync. */
const handleChargeRefunded = async (charge: Stripe.Charge) => {
  const paymentIntentId = intentIdOf(charge.payment_intent);
  if (!paymentIntentId) return;

  await prisma.payment.updateMany({
    where: { stripePaymentIntentId: paymentIntentId },
    data: {
      refundedAmount: charge.amount_refunded / 100,
      refundedAt: new Date(),
    },
  });
};

export const paymentUtils = {
  refundPayment,
  expireOpenSessions,
  handleSessionCompleted,
  handleSessionExpired,
  handleChargeRefunded,
};
