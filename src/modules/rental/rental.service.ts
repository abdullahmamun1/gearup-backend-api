import { Prisma } from "../../../generated/prisma/client";
import {
  CancelReason,
  DepositStatus,
  PaymentStatus,
  RentalStatus,
  Role,
  UserStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { createError } from "../../utils/createError";
import { daysBetween, parseDateKey, today } from "../../utils/dates";
import { paymentUtils } from "../payment/payment.util";
import { rentalAvailability } from "./rental.availability";
import {
  ICreateRentalOrderInput,
  IGetOrderQueryParams,
} from "./rental.interface";
import {
  RENTAL_POLICY,
  freeCancellationUntil,
  respondByFor,
} from "./rental.policy";

const partySelect = { select: { id: true, name: true, email: true } };

export const orderInclude = {
  items: { include: { gearItem: true } },
  customer: partySelect,
  provider: partySelect,
} satisfies Prisma.RentalOrderInclude;

// ------------------------------------------------------------ expiry

let lastExpiryRun = 0;
const EXPIRY_INTERVAL_MS = 60 * 1000;

/**
 * Cancels PLACED orders the provider never answered and CONFIRMED orders the
 * customer never paid. Availability already ignores them once their deadline
 * passes, so this only tidies up statuses. Runs lazily before order reads
 * (at most once a minute per instance) and from the daily cron job.
 */
const expireStaleOrders = async (force = false) => {
  const now = new Date();
  if (!force && now.getTime() - lastExpiryRun < EXPIRY_INTERVAL_MS) {
    return { noResponse: 0, unpaid: 0 };
  }
  lastExpiryRun = now.getTime();

  const [noResponse, unpaid] = await prisma.$transaction([
    prisma.rentalOrder.updateMany({
      where: { status: RentalStatus.PLACED, respondBy: { lte: now } },
      data: {
        status: RentalStatus.CANCELLED,
        cancelReason: CancelReason.NO_PROVIDER_RESPONSE,
        cancelledAt: now,
      },
    }),
    prisma.rentalOrder.updateMany({
      where: {
        status: RentalStatus.CONFIRMED,
        paymentDueAt: {
          lte: new Date(now.getTime() - RENTAL_POLICY.paymentGraceMs),
        },
      },
      data: {
        status: RentalStatus.CANCELLED,
        cancelReason: CancelReason.PAYMENT_EXPIRED,
        cancelledAt: now,
      },
    }),
  ]);
  return { noResponse: noResponse.count, unpaid: unpaid.count };
};

// ------------------------------------------------------------ create

const createRentalOrder = async (
  customerId: string,
  payload: ICreateRentalOrderInput,
) => {
  const now = new Date();
  const start = parseDateKey(payload.startDate);
  const end = parseDateKey(payload.endDate);
  const days = daysBetween(start, end);
  const firstBookableDay = today(now);

  if (start < firstBookableDay) {
    throw createError(400, "The start date can't be in the past");
  }
  if (days < 1) {
    throw createError(400, "The end date must be after the start date");
  }
  if (days > RENTAL_POLICY.maxRentalDays) {
    throw createError(
      400,
      `Rentals can be at most ${RENTAL_POLICY.maxRentalDays} days long`,
    );
  }
  if (daysBetween(firstBookableDay, start) > RENTAL_POLICY.maxDaysAhead) {
    throw createError(
      400,
      `Rentals can be booked at most ${RENTAL_POLICY.maxDaysAhead} days ahead`,
    );
  }

  // The same gear listed twice is one line with the combined quantity.
  const quantities = new Map<string, number>();
  for (const item of payload.items) {
    quantities.set(
      item.gearItemId,
      (quantities.get(item.gearItemId) ?? 0) + item.quantity,
    );
  }

  const gears = await prisma.gearItem.findMany({
    where: { id: { in: [...quantities.keys()] } },
    include: { provider: { select: { id: true, status: true } } },
  });
  const gearById = new Map(gears.map((gear) => [gear.id, gear]));

  for (const gearItemId of quantities.keys()) {
    const gear = gearById.get(gearItemId);
    if (!gear) {
      throw createError(404, `Gear item with ID ${gearItemId} not found`);
    }
    if (!gear.isAvailable || gear.provider.status === UserStatus.SUSPENDED) {
      throw createError(400, `${gear.name} is not available for rent`);
    }
  }

  const providerIds = new Set(gears.map((gear) => gear.providerId));
  if (providerIds.size > 1) {
    throw createError(
      400,
      "An order can only contain gear from one provider. Please place a separate order for each provider.",
    );
  }
  const providerId = [...providerIds][0]!;

  const lines = gears.map((gear) => ({ gear, quantity: quantities.get(gear.id)! }));
  const totalAmount = lines.reduce(
    (sum, { gear, quantity }) => sum + Number(gear.pricePerDay) * quantity * days,
    0,
  );
  const depositAmount = lines.reduce(
    (sum, { gear, quantity }) => sum + Number(gear.depositAmount) * quantity,
    0,
  );

  return prisma.$transaction(async (tx) => {
    await rentalAvailability.lockAndAssertAvailable(tx, lines, start, end);

    return tx.rentalOrder.create({
      data: {
        customerId,
        providerId,
        startDate: start,
        endDate: end,
        totalAmount,
        depositAmount,
        status: RentalStatus.PLACED,
        respondBy: respondByFor(start, now),
        items: {
          create: lines.map(({ gear, quantity }) => ({
            gearItemId: gear.id,
            quantity,
            pricePerDay: gear.pricePerDay,
          })),
        },
      },
      include: orderInclude,
    });
  });
};

// ------------------------------------------------------------- read

const getRentalOrders = async (
  customerId: string,
  query: IGetOrderQueryParams,
) => {
  await expireStaleOrders();

  const page = query.page ? Number(query.page) : 1;
  const limit = query.limit ? Number(query.limit) : 10;
  const skip = (page - 1) * limit;
  const where = {
    customerId,
    status: query.status ? (query.status as RentalStatus) : undefined,
  };

  const [orders, totalCount] = await Promise.all([
    prisma.rentalOrder.findMany({
      where,
      skip,
      take: limit,
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

const getRentalOrderById = async (
  orderId: string,
  userId: string,
  role: Role,
) => {
  await expireStaleOrders();

  const order = await prisma.rentalOrder.findUnique({
    where: { id: orderId },
    include: { ...orderInclude, payments: true, review: true },
  });
  if (!order) {
    throw createError(404, "Rental Order not found");
  }

  const isOwner = order.customerId === userId;
  const isProvider = order.providerId === userId;
  if (role !== Role.ADMIN && !isOwner && !isProvider) {
    throw createError(403, "You do not have access to this order");
  }
  return order;
};

// ----------------------------------------------------------- cancel

const cancelRentalOrder = async (customerId: string, orderId: string) => {
  const now = new Date();
  const order = await prisma.rentalOrder.findUnique({
    where: { id: orderId },
    include: { payments: true },
  });
  if (!order) {
    throw createError(404, "Rental Order not found");
  }
  if (order.customerId !== customerId) {
    throw createError(403, "You do not own this order");
  }

  const cancelled = {
    status: RentalStatus.CANCELLED,
    cancelReason: CancelReason.CUSTOMER,
    cancelledAt: now,
  };

  if (
    order.status === RentalStatus.PLACED ||
    order.status === RentalStatus.CONFIRMED
  ) {
    const updated = await prisma.rentalOrder.updateMany({
      where: { id: orderId, status: order.status },
      data: cancelled,
    });
    if (updated.count === 0) {
      throw createError(409, "This order changed meanwhile. Please refresh.");
    }
    if (order.status === RentalStatus.CONFIRMED) {
      await paymentUtils.expireOpenSessions(orderId);
    }
  } else if (order.status === RentalStatus.PAID) {
    if (now > freeCancellationUntil(order.startDate)) {
      throw createError(
        400,
        "Paid rentals can only be cancelled at least 24 hours before the start date",
      );
    }

    const payment = order.payments.find(
      (row) => row.status === PaymentStatus.COMPLETED,
    );
    if (!payment) {
      throw createError(409, "No completed payment found to refund");
    }
    const refundable = Number(payment.amount) - Number(payment.refundedAmount);
    await paymentUtils.refundPayment(
      payment,
      refundable,
      `cancel-refund-${order.id}`,
    );

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { refundedAmount: payment.amount, refundedAt: now },
      }),
      prisma.rentalOrder.update({
        where: { id: orderId },
        data: {
          ...cancelled,
          ...(Number(order.depositAmount) > 0 && {
            depositStatus: DepositStatus.REFUNDED,
          }),
        },
      }),
    ]);
  } else {
    throw createError(400, `Cannot cancel an order in ${order.status} status`);
  }

  return prisma.rentalOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { ...orderInclude, payments: true, review: true },
  });
};

export const rentalService = {
  createRentalOrder,
  getRentalOrders,
  getRentalOrderById,
  cancelRentalOrder,
  expireStaleOrders,
};
