import Stripe from "stripe";
import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
import { createError } from "../../utils/createError";
import config from "../../config";
import { paymentUtils } from "./payment.util";
import { IGetQueryParams } from "../provider/provider.interface";

const createCheckoutSession = async (orderId: string, customerId: string) => {
  const order = await prisma.rentalOrder.findUnique({
    where: {
      id: orderId,
    },
    include: { customer: { select: { email: true, name: true } } },
  });
  if (!order) {
    throw createError(404, "Rental Order not found");
  }
  if (order.customerId !== customerId) {
    throw createError(403, "You do not own this order");
  }
  if (order.status !== "CONFIRMED") {
    throw createError(400, `Cannot pay for an order in ${order.status} status`);
  }

  const existingPending = await prisma.payment.findFirst({
    where: {
      rentalOrderId: orderId,
      status: "PENDING",
    },
  });
  if (existingPending) {
    const session = await stripe.checkout.sessions.retrieve(
      existingPending.transactionId,
    );
    return { paymentUrl: session.url, payment: existingPending };
  }

  const amountInCents = Math.round(Number(order.totalAmount) * 100);
  if (Number(order.totalAmount) < 65) {
    throw createError(
      400,
      "Order amount is too low to process payment. Minimum order amount is ৳65.",
    );
  }
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: order.customer.email,
    line_items: [
      {
        price_data: {
          currency: "bdt",
          product_data: { name: `GearUp Rental Order ${order.id}` },
          unit_amount: amountInCents,
        },
        quantity: 1,
      },
    ],
    metadata: { rentalOrderId: order.id, customerId },
    success_url: `${config.app_url}/payment-success?orderId=${order.id}`,
    cancel_url: `${config.app_url}/payment-cancelled?orderId=${order.id}`,
  });

  const payment = await prisma.payment.create({
    data: {
      transactionId: session.id,
      amount: order.totalAmount,
      gateway: "STRIPE",
      status: "PENDING",
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
  }

  return { received: true };
};

const getCustomerPayments = async (
  customerId: string,
  query: IGetQueryParams,
) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;

  const payments = await prisma.payment.findMany({
    where: {
      customerId,
    },
    take: limit,
    skip,
    orderBy: { createdAt: "desc" },
    include: { rentalOrder: true },
  });
  const totalCount = await prisma.payment.count({
    where: {
      customerId,
    },
  });
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
    include: { rentalOrder: true },
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
