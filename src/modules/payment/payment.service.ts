import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
import { createError } from "../../utils/createError";

const createPaymentIntent = async (orderId: string, customerId: string) => {
  const order = await prisma.rentalOrder.findUnique({
    where: {
      id: orderId,
    },
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
    const intent = await stripe.paymentIntents.retrieve(
      existingPending.transactionId,
    );
    return { clientSecret: intent.client_secret, payment: existingPending };
  }

  const amountInCents = Math.round(Number(order.totalAmount) * 100);
  const intent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: "bdt",
    metadata: { rentalOrderId: order.id, customerId },
  });

  const payment = await prisma.payment.create({
    data: {
      transactionId: intent.id,
      amount: order.totalAmount,
      gateway: "STRIPE",
      status: "PENDING",
      rentalOrderId: order.id,
      customerId,
    },
  });
  return { clientSecret: intent.client_secret, payment };
};

const handleWebhookEvent = async () => {};

export const paymentService = {
  createPaymentIntent,
  handleWebhookEvent,
};
