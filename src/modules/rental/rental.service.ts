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
import { approximate } from "../../utils/geo";
import { emailService, orderEmailInclude } from "../email/email.service";
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

  const rules = [
    {
      reason: CancelReason.NO_PROVIDER_RESPONSE,
      where: { status: RentalStatus.PLACED, respondBy: { lte: now } },
    },
    {
      reason: CancelReason.PAYMENT_EXPIRED,
      where: {
        status: RentalStatus.CONFIRMED,
        paymentDueAt: {
          lte: new Date(now.getTime() - RENTAL_POLICY.paymentGraceMs),
        },
      },
    },
  ] satisfies { reason: CancelReason; where: Prisma.RentalOrderWhereInput }[];

  const counts = { noResponse: 0, unpaid: 0 };
  for (const rule of rules) {
    const stale = await prisma.rentalOrder.findMany({
      where: rule.where,
      include: orderEmailInclude,
    });

    for (const order of stale) {
      const cancelledNow = await prisma.$transaction(async (tx) => {
        // Conditional: skip it if someone acted on the order meanwhile.
        const updated = await tx.rentalOrder.updateMany({
          where: { id: order.id, ...rule.where },
          data: {
            status: RentalStatus.CANCELLED,
            cancelReason: rule.reason,
            cancelledAt: now,
          },
        });
        if (updated.count === 0) return false;
        await emailService.enqueue(
          tx,
          emailService.cancellationEmails(order, rule.reason, ["customer", "provider"]),
        );
        return true;
      });
      if (cancelledNow) {
        counts[rule.reason === CancelReason.PAYMENT_EXPIRED ? "unpaid" : "noResponse"]++;
      }
    }
  }

  if (counts.noResponse + counts.unpaid > 0) emailService.dispatchSoon();
  return counts;
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

  const created = await prisma.$transaction(async (tx) => {
    await rentalAvailability.lockAndAssertAvailable(tx, lines, start, end);

    const order = await tx.rentalOrder.create({
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

    await emailService.enqueue(
      tx,
      (["customer", "provider"] as const).map((audience) => {
        const { to, payload } = emailService.orderRecipient(order, audience);
        return {
          to,
          template: "orderPlaced",
          payload: { ...payload, respondBy: order.respondBy!.toISOString() },
          dedupeKey: `placed:${order.id}:${audience}`,
        };
      }),
    );
    return order;
  });
  emailService.dispatchSoon();
  return created;
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

  // Where to collect the gear: the exact point once the order is paid,
  // only the neighbourhood before that.
  const place = await prisma.user.findUnique({
    where: { id: order.providerId },
    select: { city: true, area: true, latitude: true, longitude: true },
  });
  const exact = PICKUP_REVEALED.includes(order.status);
  const pickup = place && {
    city: place.city,
    area: place.area,
    exact,
    location: exact
      ? place.latitude !== null && place.longitude !== null
        ? { latitude: place.latitude, longitude: place.longitude }
        : null
      : approximate(place.latitude, place.longitude),
  };
  return { ...order, pickup };
};

/** Statuses where the customer has paid and needs the real pickup point. */
const PICKUP_REVEALED: RentalStatus[] = [
  RentalStatus.PAID,
  RentalStatus.PICKED_UP,
  RentalStatus.RETURNED,
];

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
    await prisma.$transaction(async (tx) => {
      const updated = await tx.rentalOrder.updateMany({
        where: { id: orderId, status: order.status },
        data: cancelled,
      });
      if (updated.count === 0) {
        throw createError(409, "This order changed meanwhile. Please refresh.");
      }
      const forEmail = await emailService.loadOrderForEmail(tx, orderId);
      await emailService.enqueue(
        tx,
        emailService.cancellationEmails(forEmail, CancelReason.CUSTOMER, ["provider"]),
      );
    });
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

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { refundedAmount: payment.amount, refundedAt: now },
      });
      await tx.rentalOrder.update({
        where: { id: orderId },
        data: {
          ...cancelled,
          ...(Number(order.depositAmount) > 0 && {
            depositStatus: DepositStatus.REFUNDED,
          }),
        },
      });
      const forEmail = await emailService.loadOrderForEmail(tx, orderId);
      await emailService.enqueue(
        tx,
        emailService.cancellationEmails(
          forEmail,
          CancelReason.CUSTOMER,
          ["customer", "provider"],
          { refunded: refundable },
        ),
      );
    });
  } else {
    throw createError(400, `Cannot cancel an order in ${order.status} status`);
  }
  emailService.dispatchSoon();

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
