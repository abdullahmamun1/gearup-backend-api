import { PaymentStatus, RentalStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { monthKey, monthsAgoStart, monthsBetween } from "../../utils/months";

/** Six months of history, current month included. */
const MONTHS = 6;

/** Orders that earned money for the provider. */
const EARNING: RentalStatus[] = [
  RentalStatus.PAID,
  RentalStatus.PICKED_UP,
  RentalStatus.RETURNED,
];

const byStatus = (rows: { status: RentalStatus; _count: { _all: number } }[]) =>
  Object.values(RentalStatus).map((status) => ({
    status,
    count: rows.find((row) => row.status === status)?._count._all ?? 0,
  }));

/** A customer's spending per month (net of refunds) and orders by status. */
const getCustomerStats = async (customerId: string) => {
  const from = monthsAgoStart(MONTHS);
  const [payments, statuses] = await Promise.all([
    prisma.payment.findMany({
      where: {
        customerId,
        status: PaymentStatus.COMPLETED,
        paidAt: { gte: from },
      },
      select: { amount: true, refundedAmount: true, paidAt: true },
    }),
    prisma.rentalOrder.groupBy({
      by: ["status"],
      where: { customerId },
      _count: { _all: true },
    }),
  ]);

  const months = new Map(monthsBetween(from, new Date()).map((m) => [m, 0]));
  for (const payment of payments) {
    const key = monthKey(payment.paidAt!);
    if (months.has(key)) {
      months.set(
        key,
        months.get(key)! + Number(payment.amount) - Number(payment.refundedAmount),
      );
    }
  }

  return {
    spendingByMonth: [...months].map(([month, amount]) => ({
      month,
      amount: Math.round(amount),
    })),
    ordersByStatus: byStatus(statuses),
  };
};

/**
 * A provider's rental earnings per month (by payment date), orders by status
 * and their most-rented gear.
 */
const getProviderStats = async (providerId: string) => {
  const from = monthsAgoStart(MONTHS);
  const [earning, statuses, items] = await Promise.all([
    prisma.rentalOrder.findMany({
      where: {
        providerId,
        status: { in: EARNING },
        payments: { some: { status: PaymentStatus.COMPLETED, paidAt: { gte: from } } },
      },
      select: {
        totalAmount: true,
        payments: {
          where: { status: PaymentStatus.COMPLETED },
          select: { paidAt: true },
          take: 1,
        },
      },
    }),
    prisma.rentalOrder.groupBy({
      by: ["status"],
      where: { providerId },
      _count: { _all: true },
    }),
    prisma.orderItem.groupBy({
      by: ["gearItemId"],
      where: { rentalOrder: { providerId, status: { in: EARNING } } },
      _count: { _all: true },
      orderBy: { _count: { gearItemId: "desc" } },
      take: 5,
    }),
  ]);

  const months = new Map(monthsBetween(from, new Date()).map((m) => [m, 0]));
  for (const order of earning) {
    const paidAt = order.payments[0]?.paidAt;
    if (!paidAt) continue;
    const key = monthKey(paidAt);
    if (months.has(key)) months.set(key, months.get(key)! + Number(order.totalAmount));
  }

  const names = new Map(
    (
      await prisma.gearItem.findMany({
        where: { id: { in: items.map((item) => item.gearItemId) } },
        select: { id: true, name: true },
      })
    ).map((gear) => [gear.id, gear.name]),
  );

  return {
    earningsByMonth: [...months].map(([month, amount]) => ({
      month,
      amount: Math.round(amount),
    })),
    ordersByStatus: byStatus(statuses),
    topGear: items.map((item) => ({
      id: item.gearItemId,
      name: names.get(item.gearItemId) ?? "—",
      orders: item._count._all,
    })),
  };
};

export const statsService = { getCustomerStats, getProviderStats };
