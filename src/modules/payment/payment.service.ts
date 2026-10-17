import Stripe from "stripe";
import { PaymentStatus, RentalStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
import { createError } from "../../utils/createError";
import config from "../../config";
import { EMAIL_NOT_VERIFIED } from "../auth/auth.service";
import { rentalService } from "../rental/rental.service";
import { paymentUtils, toStripeAmount } from "./payment.util";
import { IGetQueryParams } from "../provider/provider.interface";

export interface IGetPaymentsQueryParams extends IGetQueryParams {
  status?: PaymentStatus;
}

/** Stripe sessions must expire 30 min – 24 h after creation. */
const sessionExpiry = (paymentDueAt: Date, now: Date) => {
  const earliest = now.getTime() + 31 * 60 * 1000;
  const latest = now.getTime() + 23 * 60 * 60 * 1000;
  const target = Math.min(Math.max(paymentDueAt.getTime(), earliest), latest);
  return Math.floor(target / 1000);
};

const MIN_CHARGE = 65;

const createCheckoutSession = async (orderId: string, customerId: string) => {
  const now = new Date();
  const order = await prisma.rentalOrder.findUnique({
    where: {
      id: orderId,
    },
    include: {
      customer: { select: { email: true, name: true, emailVerifiedAt: true } },
    },
  });
  if (!order) {
    throw createError(404, "Rental Order not found");
  }
  if (order.customerId !== customerId) {
    throw createError(403, "You do not own this order");
  }
  if (!order.customer.emailVerifiedAt) {
    throw createError(403, EMAIL_NOT_VERIFIED);
  }
  if (order.status !== RentalStatus.CONFIRMED) {
    throw createError(400, `Cannot pay for an order in ${order.status} status`);
  }
  if (!order.paymentDueAt || order.paymentDueAt <= now) {
    await rentalService.expireStaleOrders(true);
    throw createError(
      400,
      "The payment window for this order has closed. Please book again.",
    );
  }

  const existingPending = await prisma.payment.findFirst({
    where: {
      rentalOrderId: orderId,
      status: PaymentStatus.PENDING,
    },
  });
  if (existingPending) {
    const session = await stripe.checkout.sessions
      .retrieve(existingPending.transactionId)
      .catch(() => null);
    if (session?.status === "open" && session.url) {
      return { paymentUrl: session.url, payment: existingPending };
    }
    await prisma.payment.update({
      where: { id: existingPending.id },
      data: { status: PaymentStatus.FAILED },
    });
  }

  const rental = Number(order.totalAmount);
  const deposit = Number(order.depositAmount);
  const charge = rental + deposit;
  if (charge < MIN_CHARGE) {
    throw createError(
      400,
      `Order amount is too low to process payment. Minimum order amount is ৳${MIN_CHARGE}.`,
    );
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: "bdt",
        product_data: { name: `GearUp rental · order ${order.id.slice(0, 8)}` },
        unit_amount: toStripeAmount(rental),
      },
      quantity: 1,
    },
  ];
  if (deposit > 0) {
    lineItems.push({
      price_data: {
        currency: "bdt",
        product_data: {
          name: "Refundable security deposit",
          description: "Refunded when the gear is returned in good condition.",
        },
        unit_amount: toStripeAmount(deposit),
      },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: order.customer.email,
    line_items: lineItems,
    expires_at: sessionExpiry(order.paymentDueAt, now),
    metadata: { rentalOrderId: order.id, customerId },
    success_url: `${config.app_url}/payment-success?orderId=${order.id}`,
    cancel_url: `${config.app_url}/payment-cancelled?orderId=${order.id}`,
  });

  const payment = await prisma.payment.create({
    data: {
      transactionId: session.id,
      amount: charge,
      gateway: "STRIPE",
      status: PaymentStatus.PENDING,
      rentalOrderId: order.id,
      customerId,
    },
  });
  return { paymentUrl: session.url, payment };
};

const handleWebhookEvent = async (payload: Buffer, signature: string) => {
  let event: Stripe.Event;
  try {
    const endpointSecret = config.stripe_webhook_secret;
    event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
  } catch (err) {
    throw createError(400, `Webhook signature verification failed`);
  }
  switch (event.type) {
    case "checkout.session.completed":
      await paymentUtils.handleSessionCompleted(event.data.object);
      break;
    case "checkout.session.expired":
      await paymentUtils.handleSessionExpired(event.data.object);
      break;
    case "charge.refunded":
      await paymentUtils.handleChargeRefunded(event.data.object);
      break;
  }

  return { received: true };
};

const getCustomerPayments = async (
  customerId: string,
  query: IGetPaymentsQueryParams,
) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;

  const where = {
    customerId,
    status: query.status ? (query.status as PaymentStatus) : undefined,
  };

  const payments = await prisma.payment.findMany({
    where,
    take: limit,
    skip,
    orderBy: { createdAt: "desc" },
    include: {
      rentalOrder: { include: { items: { include: { gearItem: true } } } },
    },
  });
  const totalCount = await prisma.payment.count({ where });
  return {
    data: payments,
    meta: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

const getPaymentsbyId = async (customerId: string, paymentId: string) => {
  const payment = await prisma.payment.findUnique({
    where: {
      customerId,
      id: paymentId,
    },
    include: {
      rentalOrder: { include: { items: { include: { gearItem: true } } } },
    },
  });
  if (!payment) {
    throw createError(404, "Payment Not Found");
  }
  if (payment.customerId !== customerId) {
    throw createError(403, "You do not own this payment");
  }
  return payment;
};

export const paymentService = {
  createCheckoutSession,
  handleWebhookEvent,
  getCustomerPayments,
  getPaymentsbyId,
};
