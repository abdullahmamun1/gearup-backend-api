import { RentalStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../../lib/prisma";
import { createError } from "../../utils/createError";
import { IProviderOrderQueryParams } from "./provider.interface";

const getProviderOrders = async (
  providerId: string,
  query: IProviderOrderQueryParams,
) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;

  const orders = await prisma.rentalOrder.findMany({
    where: {
      items: {
        some: {
          gearItem: {
            providerId: providerId,
          },
        },
      },
    },
    take: limit,
    skip,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      items: {
        include: {
          gearItem: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
  const totalCount = await prisma.rentalOrder.count({
    where: {
      items: {
        some: {
          gearItem: {
            providerId: providerId,
          },
        },
      },
    },
  });

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

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PLACED: ["CONFIRMED"],
  CONFIRMED: [],
  PAID: ["PICKED_UP"],
  PICKED_UP: ["RETURNED"],
};

const updateOrderStatus = async (
  providerId: string,
  orderId: string,
  nextStatus: RentalStatus,
) => {
  const order = await prisma.rentalOrder.findUnique({
    where: {
      id: orderId,
    },
    include: {
      items: {
        include: {
          gearItem: true,
        },
      },
    },
  });
  if (!order) {
    throw createError(404, "Order not found");
  }

  const isProviderInvolved = order.items.some(
    (item) => item.gearItem.providerId === providerId,
  );
  if (!isProviderInvolved) {
    throw createError(403, "You are not authorized to update this order");
  }

  const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw createError(
      400,
      `Invalid status transition from ${order.status} to ${nextStatus}`,
    );
  }

  const updatedOrder = await prisma.rentalOrder.update({
    where: {
      id: orderId,
    },
    data: {
      status: nextStatus,
    },
  });
  return updatedOrder;
};

export const providerService = {
  getProviderOrders,
  updateOrderStatus,
};
