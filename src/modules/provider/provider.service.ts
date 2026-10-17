import {
  CancelReason,
  DepositStatus,
  PaymentStatus,
  RentalStatus,
} from "../../../generated/prisma/enums";
import { RentalOrderUpdateManyMutationInput } from "../../../generated/prisma/models";
import { prisma } from "../../lib/prisma";
import { createError } from "../../utils/createError";
import { paymentUtils } from "../payment/payment.util";
import { paymentDueFor } from "../rental/rental.policy";
import { orderInclude, rentalService } from "../rental/rental.service";
import {
  IGetProviderOrdersQueryParams,
  IUpdateOrderStatusPayload,
} from "./provider.interface";

const getProviderOrders = async (
  providerId: string,
  query: IGetProviderOrdersQueryParams,
) => {
  await rentalService.expireStaleOrders();

  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const where = {
    providerId,
    status: query.status ? (query.status as RentalStatus) : undefined,
  };

  const [orders, totalCount] = await Promise.all([
    prisma.rentalOrder.findMany({
      where,
      take: limit,
      skip,
      orderBy: { createdAt: "desc" },
      include: orderInclude,
    }),
    prisma.rentalOrder.count({ where }),
  ]);

  return {
    data: orders,
    meta: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

const updateOrderStatus = async (
  providerId: string,
  orderId: string,
  payload: IUpdateOrderStatusPayload,
) => {
  const now = new Date();
  const order = await prisma.rentalOrder.findUnique({
    where: { id: orderId },
    include: { payments: true },
  });
  if (!order) {
    throw createError(404, "Order not found");
  }
  if (order.providerId !== providerId) {
    throw createError(403, "You are not authorized to update this order");
  }

  /** Applies `data` only if nobody changed the order since we read it. */
  const transition = async (data: RentalOrderUpdateManyMutationInput) => {
    const updated = await prisma.rentalOrder.updateMany({
      where: { id: orderId, status: order.status },
      data,
    });
    if (updated.count === 0) {
      throw createError(409, "This order changed meanwhile. Please refresh.");
    }
  };

  const move = `${order.status}->${payload.status}`;
  switch (move) {
    case `${RentalStatus.PLACED}->${RentalStatus.CONFIRMED}`: {
      if (!order.respondBy || order.respondBy <= now) {
        await transition({
          status: RentalStatus.CANCELLED,
          cancelReason: CancelReason.NO_PROVIDER_RESPONSE,
          cancelledAt: now,
        });
        throw createError(
          409,
          "This request expired before it was confirmed, so it was cancelled",
        );
      }
      await transition({
        status: RentalStatus.CONFIRMED,
        confirmedAt: now,
        paymentDueAt: paymentDueFor(order.startDate, now),
      });
      break;
    }

    case `${RentalStatus.PLACED}->${RentalStatus.CANCELLED}`:
      await transition({
        status: RentalStatus.CANCELLED,
        cancelReason: CancelReason.PROVIDER_DECLINED,
        cancelNote: payload.note ?? null,
        cancelledAt: now,
      });
      break;

    case `${RentalStatus.PAID}->${RentalStatus.PICKED_UP}`:
      await transition({ status: RentalStatus.PICKED_UP, pickedUpAt: now });
      break;

    case `${RentalStatus.PICKED_UP}->${RentalStatus.RETURNED}`: {
      const deposit = Number(order.depositAmount);
      const holdsDeposit =
        deposit > 0 && order.depositStatus === DepositStatus.HELD;

      if (!holdsDeposit) {
        await transition({ status: RentalStatus.RETURNED, returnedAt: now });
        break;
      }

      if (payload.condition === "DAMAGED") {
        // An admin reviews the claim before any of the deposit is kept.
        await transition({
          status: RentalStatus.RETURNED,
          returnedAt: now,
          depositStatus: DepositStatus.CLAIMED,
          damageClaimAmount: Math.min(payload.damageAmount!, deposit),
          damageNote: payload.note ?? null,
        });
        break;
      }

      const payment = order.payments.find(
        (row) => row.status === PaymentStatus.COMPLETED,
      );
      if (!payment) {
        throw createError(409, "No completed payment found for this deposit");
      }
      await paymentUtils.refundPayment(
        payment,
        deposit,
        `deposit-refund-${order.id}`,
      );
      await prisma.$transaction(async (tx) => {
        const updated = await tx.rentalOrder.updateMany({
          where: { id: orderId, status: RentalStatus.PICKED_UP },
          data: {
            status: RentalStatus.RETURNED,
            returnedAt: now,
            depositStatus: DepositStatus.REFUNDED,
          },
        });
        if (updated.count === 0) return;
        await tx.payment.update({
          where: { id: payment.id },
          data: { refundedAmount: { increment: deposit }, refundedAt: now },
        });
      });
      break;
    }

    default:
      throw createError(
        400,
        `Invalid status transition from ${order.status} to ${payload.status}`,
      );
  }

  return prisma.rentalOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: orderInclude,
  });
};

export const providerService = {
  getProviderOrders,
  updateOrderStatus,
};
