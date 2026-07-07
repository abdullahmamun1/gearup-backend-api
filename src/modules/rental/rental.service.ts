import { RentalStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../../lib/prisma";
import { createError } from "../../utils/createError";
import {
  ICreateRentalOrderInput,
  IGetOrderQueryParams,
} from "./rental.interface";

const createRentalOrder = async (
  customerId: string,
  payload: ICreateRentalOrderInput,
) => {
  const { items, startDate, endDate } = payload;
  if (!items || items.length === 0) {
    throw createError(400, "Items are required to create a rental order");
  }
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    throw createError(400, "Invalid start or end date format");
  }
  const days = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 3600 * 24),
  );
  const transaction = await prisma.$transaction(async (tx) => {
    let totalAmount = 0;
    const orderItems = [];
    for (const item of items) {
      const gearItem = await tx.gearItem.findUnique({
        where: { id: item.gearItemId },
      });
      if (!gearItem) {
        throw createError(
          404,
          `Gear item with ID ${item.gearItemId} not found`,
        );
      }
      if (!gearItem.isAvailable) {
        throw createError(
          400,
          `Gear item with ID ${item.gearItemId} is not available for rent`,
        );
      }
      if (gearItem.stock < item.quantity) {
        throw createError(
          400,
          `Insufficient stock for gear item with ID ${item.gearItemId}`,
        );
      }
      const lineCost = Number(gearItem.pricePerDay) * item.quantity * days;
      totalAmount += lineCost;
      orderItems.push({
        gearItemId: item.gearItemId,
        quantity: item.quantity,
        pricePerDay: gearItem.pricePerDay,
      });
      await tx.gearItem.update({
        where: { id: item.gearItemId },
        data: { stock: gearItem.stock - item.quantity },
      });
    }
    const order = await tx.rentalOrder.create({
      data: {
        customerId,
        startDate: start,
        endDate: end,
        totalAmount,
        status: "PLACED",
        items: {
          create: orderItems,
        },
      },
      include: {
        items: {
          include: {
            gearItem: true,
          },
        },
      },
    });
    return order;
  });
  return transaction;
};

const getRentalOrders = async (
  customerId: string,
  query: IGetOrderQueryParams,
) => {
  const page = query.page ? Number(query.page) : 1;
  const limit = query.limit ? Number(query.limit) : 10;
  const skip = (page - 1) * limit;

  const orders = await prisma.rentalOrder.findMany({
    where: {
      customerId,
      status: query.status ? (query.status as RentalStatus) : undefined,
    },
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { items: { include: { gearItem: true } } },
  });
  const totalCount = await prisma.rentalOrder.count({
    where: {
      customerId,
      status: query.status ? (query.status as RentalStatus) : undefined,
    },
  });
  return {
    data: orders,
    meta: {
      page: limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

export const rentalService = {
  createRentalOrder,
  getRentalOrders,
};
