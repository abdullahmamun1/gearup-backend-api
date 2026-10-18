import { Prisma } from "../../../generated/prisma/client";
import {
  DepositStatus,
  PaymentStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { createError } from "../../utils/createError";
import { EmailMessage } from "../email/email.interface";
import { emailService } from "../email/email.service";
import { paymentUtils } from "../payment/payment.util";
import { IGetClaimsQueryParams, IResolveClaimPayload } from "./claim.interface";

const claimInclude = {
  customer: { select: { id: true, name: true, email: true } },
  provider: { select: { id: true, name: true, email: true } },
  items: {
    include: {
      gearItem: { select: { id: true, name: true, imageUrl: true, images: true } },
    },
  },
  payments: {
    where: { status: PaymentStatus.COMPLETED },
    select: { id: true, amount: true, refundedAmount: true, paidAt: true },
  },
} satisfies Prisma.RentalOrderInclude;

const roundMoney = (amount: number) => Math.round(amount * 100) / 100;

const getClaims = async (query: IGetClaimsQueryParams) => {
  const page = query.page ? Number(query.page) : 1;
  const limit = query.limit ? Number(query.limit) : 10;
  const skip = (page - 1) * limit;
  const resolved = query.status === "resolved";

  const where: Prisma.RentalOrderWhereInput = resolved
    ? { claimResolvedAt: { not: null } }
    : { depositStatus: DepositStatus.CLAIMED };

  const [claims, total, open] = await Promise.all([
    prisma.rentalOrder.findMany({
      where,
      skip,
      take: limit,
      // Oldest open claim first (it has waited longest); newest decision first.
      orderBy: resolved ? { claimResolvedAt: "desc" } : { returnedAt: "asc" },
      include: claimInclude,
    }),
    prisma.rentalOrder.count({ where }),
    prisma.rentalOrder.count({
      where: { depositStatus: DepositStatus.CLAIMED },
    }),
  ]);
  return {
    data: claims,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    openCount: open,
  };
};

/**
 * Settles a damage claim: keep part (or all, or none) of the deposit and
 * refund the rest through Stripe. Both sides get the decision by email.
 */
const resolveClaim = async (orderId: string, payload: IResolveClaimPayload) => {
  const order = await prisma.rentalOrder.findUnique({
    where: { id: orderId },
    include: { payments: true },
  });
  if (!order) throw createError(404, "Order not found");
  if (order.depositStatus !== DepositStatus.CLAIMED) {
    throw createError(409, "This order has no open damage claim");
  }

  const deposit = Number(order.depositAmount);
  const kept = roundMoney(Math.min(payload.keepAmount, deposit));
  const refunded = roundMoney(deposit - kept);
  const depositStatus =
    refunded === 0
      ? DepositStatus.KEPT
      : kept === 0
        ? DepositStatus.REFUNDED
        : DepositStatus.PARTIALLY_REFUNDED;

  const payment = order.payments.find(
    (row) => row.status === PaymentStatus.COMPLETED,
  );
  if (refunded > 0) {
    if (!payment) {
      throw createError(409, "No completed payment found for this deposit");
    }
    // One key per order: a retry after a failed write never refunds twice.
    await paymentUtils.refundPayment(
      payment,
      refunded,
      `claim-refund-${order.id}`,
    );
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.rentalOrder.updateMany({
      where: { id: orderId, depositStatus: DepositStatus.CLAIMED },
      data: {
        depositStatus,
        claimResolvedAt: now,
        claimKeptAmount: kept,
        claimResolutionNote: payload.note || null,
      },
    });
    if (updated.count === 0) {
      throw createError(409, "Another admin settled this claim first");
    }
    if (refunded > 0 && payment) {
      await tx.payment.update({
        where: { id: payment.id },
        data: { refundedAmount: { increment: refunded }, refundedAt: now },
      });
    }

    const forEmail = await emailService.loadOrderForEmail(tx, orderId);
    const messages: EmailMessage[] = (["customer", "provider"] as const).map(
      (audience) => {
        const { to, payload: base } = emailService.orderRecipient(
          forEmail,
          audience,
        );
        return {
          to,
          template: "claimResolved",
          payload: { ...base, kept, refunded, note: payload.note || null },
          dedupeKey: `claim-resolved:${orderId}:${audience}`,
        };
      },
    );
    await emailService.enqueue(tx, messages);
  });
  emailService.dispatchSoon();

  return prisma.rentalOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: claimInclude,
  });
};

export const claimService = { getClaims, resolveClaim };
