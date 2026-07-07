import Stripe from "stripe";
import { prisma } from "../../lib/prisma";

const handleSessionCompleted = async (session: Stripe.Checkout.Session) => {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { transactionId: session.id },
    });
    if (!payment) return;

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "COMPLETED",
        paidAt: new Date(),
      },
    });
    await prisma.rentalOrder.update({
      where: { id: payment.rentalOrderId },
      data: {
        status: "PAID",
      },
    });
  });
};

const handleSessionExpired = async (session: Stripe.Checkout.Session) => {
  await prisma.$transaction(async (tx) => {
    await prisma.payment.updateMany({
      where: {
        transactionId: session.id,
      },
      data: {
        status: "FAILED",
      },
    });
  });
};

export const paymentUtils = {
  handleSessionCompleted,
  handleSessionExpired,
};
