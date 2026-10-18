import { Response } from "express";
import {
  PaymentStatus,
  RentalStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { addDays, parseDateKey, today } from "../../utils/dates";
import { DHAKA_OFFSET_MS, monthKey, monthsBetween } from "../../utils/months";
import { IExportType, IReportRange } from "./report.interface";

/** Orders that earned money (paid and not cancelled). */
const EARNING: RentalStatus[] = [
  RentalStatus.PAID,
  RentalStatus.PICKED_UP,
  RentalStatus.RETURNED,
];

/** [from, to) as Dates; defaults to the last ~6 months. */
const resolveRange = (range: IReportRange) => {
  const to = range.to ? addDays(parseDateKey(range.to), 1) : addDays(today(), 1);
  const from = range.from
    ? parseDateKey(range.from)
    : new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 5, 1));
  // Calendar days are Dhaka days stored as UTC midnight; shift to instants.
  return {
    from: new Date(from.getTime() - DHAKA_OFFSET_MS),
    to: new Date(to.getTime() - DHAKA_OFFSET_MS),
  };
};

const getAnalytics = (range: IReportRange) => {
  const { from, to } = resolveRange(range);
  return analyticsBetween(from, to);
};

/** The analytics for [from, to) (instants). Also used for comparisons. */
const analyticsBetween = async (from: Date, to: Date) => {
  const inRange = { gte: from, lt: to };

  const [payments, orders, newUsers, activeListings] = await Promise.all([
    prisma.payment.findMany({
      where: { status: PaymentStatus.COMPLETED, paidAt: inRange },
      select: { amount: true, refundedAmount: true, paidAt: true },
    }),
    prisma.rentalOrder.findMany({
      where: { createdAt: inRange },
      select: {
        status: true,
        totalAmount: true,
        providerId: true,
        provider: { select: { name: true, city: true } },
        items: {
          take: 1,
          select: { gearItem: { select: { category: { select: { name: true } } } } },
        },
      },
    }),
    prisma.user.count({ where: { createdAt: inRange } }),
    prisma.gearItem.count({ where: { isAvailable: true } }),
  ]);

  // Revenue: money in (rental + deposits) minus refunds, by month paid.
  const byMonth = new Map(
    monthsBetween(from, to).map((month) => [
      month,
      { gross: 0, refunded: 0 },
    ]),
  );
  for (const payment of payments) {
    const row = byMonth.get(monthKey(payment.paidAt!));
    if (!row) continue;
    row.gross += Number(payment.amount);
    row.refunded += Number(payment.refundedAmount);
  }
  const revenueByMonth = [...byMonth].map(([month, row]) => ({
    month,
    gross: Math.round(row.gross),
    refunded: Math.round(row.refunded),
    net: Math.round(row.gross - row.refunded),
  }));

  const statusCounts = new Map<RentalStatus, number>();
  const categories = new Map<string, { orders: number; revenue: number }>();
  const providers = new Map<
    string,
    { name: string; orders: number; revenue: number }
  >();
  const cities = new Map<string, number>();

  for (const order of orders) {
    statusCounts.set(order.status, (statusCounts.get(order.status) ?? 0) + 1);
    const earning = EARNING.includes(order.status);
    const amount = earning ? Number(order.totalAmount) : 0;

    // Orders are single-provider and almost always single-item: credit the
    // order to its first item's category.
    const category = order.items[0]?.gearItem.category.name ?? "Other";
    const cat = categories.get(category) ?? { orders: 0, revenue: 0 };
    cat.orders += 1;
    cat.revenue += amount;
    categories.set(category, cat);

    const provider = providers.get(order.providerId) ?? {
      name: order.provider.name,
      orders: 0,
      revenue: 0,
    };
    provider.orders += 1;
    provider.revenue += amount;
    providers.set(order.providerId, provider);

    const city = order.provider.city ?? "Not set";
    cities.set(city, (cities.get(city) ?? 0) + 1);
  }

  const earningOrders = orders.filter((order) => EARNING.includes(order.status));
  const rentalRevenue = earningOrders.reduce(
    (sum, order) => sum + Number(order.totalAmount),
    0,
  );

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    totals: {
      netRevenue: revenueByMonth.reduce((sum, row) => sum + row.net, 0),
      orders: orders.length,
      paidOrders: earningOrders.length,
      averageOrderValue: earningOrders.length
        ? Math.round(rentalRevenue / earningOrders.length)
        : 0,
      newUsers,
      activeListings,
    },
    revenueByMonth,
    ordersByStatus: Object.values(RentalStatus).map((status) => ({
      status,
      count: statusCounts.get(status) ?? 0,
    })),
    topCategories: [...categories]
      .map(([name, row]) => ({ name, ...row, revenue: Math.round(row.revenue) }))
      .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)
      .slice(0, 6),
    topProviders: [...providers]
      .map(([id, row]) => ({ id, ...row, revenue: Math.round(row.revenue) }))
      .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)
      .slice(0, 6),
    rentalsByCity: [...cities]
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count),
  };
};

// ------------------------------------------------------------------ CSV

/**
 * One CSV cell. Quotes when needed, and defuses spreadsheet formulas: a cell
 * starting with = + - @ (or a tab/CR) would run as a formula in Excel.
 */
const cell = (value: unknown) => {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const row = (values: unknown[]) => `${values.map(cell).join(",")}\r\n`;

const BATCH = 500;

/** Streams rows page by page, so big exports never sit in memory. */
async function* paged<T>(load: (skip: number) => Promise<T[]>) {
  for (let skip = 0; ; skip += BATCH) {
    const rows = await load(skip);
    yield* rows;
    if (rows.length < BATCH) return;
  }
}

const exportCsv = async (
  type: IExportType,
  range: IReportRange,
  res: Response,
) => {
  const { from, to } = resolveRange(
    range.from || range.to ? range : { from: "2000-01-01" },
  );
  const createdAt = { gte: from, lt: to };
  const filename = `gearup-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  // BOM so Excel opens UTF-8 (৳, names) correctly.
  res.write("﻿");

  if (type === "users") {
    res.write(row(["id", "name", "email", "role", "status", "phone", "city", "email_verified", "joined"]));
    for await (const user of paged((skip) =>
      prisma.user.findMany({
        where: { createdAt },
        orderBy: { createdAt: "asc" },
        skip,
        take: BATCH,
        select: { id: true, name: true, email: true, role: true, status: true, phone: true, city: true, emailVerifiedAt: true, createdAt: true },
      }),
    )) {
      res.write(row([user.id, user.name, user.email, user.role, user.status, user.phone, user.city, user.emailVerifiedAt ? "yes" : "no", user.createdAt]));
    }
  } else if (type === "rentals") {
    res.write(row(["id", "status", "customer", "customer_email", "provider", "items", "start", "end", "rental_bdt", "deposit_bdt", "deposit_status", "created"]));
    for await (const order of paged((skip) =>
      prisma.rentalOrder.findMany({
        where: { createdAt },
        orderBy: { createdAt: "asc" },
        skip,
        take: BATCH,
        include: {
          customer: { select: { name: true, email: true } },
          provider: { select: { name: true } },
          items: { include: { gearItem: { select: { name: true } } } },
        },
      }),
    )) {
      res.write(
        row([
          order.id, order.status, order.customer.name, order.customer.email, order.provider.name,
          order.items.map((item) => `${item.gearItem.name} x${item.quantity}`).join("; "),
          order.startDate.toISOString().slice(0, 10), order.endDate.toISOString().slice(0, 10),
          order.totalAmount, order.depositAmount, order.depositStatus, order.createdAt,
        ]),
      );
    }
  } else if (type === "payments") {
    res.write(row(["id", "order", "customer_email", "status", "amount_bdt", "refunded_bdt", "paid_at", "stripe_session"]));
    for await (const payment of paged((skip) =>
      prisma.payment.findMany({
        where: { createdAt },
        orderBy: { createdAt: "asc" },
        skip,
        take: BATCH,
        include: { customer: { select: { email: true } } },
      }),
    )) {
      res.write(row([payment.id, payment.rentalOrderId, payment.customer.email, payment.status, payment.amount, payment.refundedAmount, payment.paidAt, payment.transactionId]));
    }
  } else {
    res.write(row(["email", "status", "confirmed_at", "unsubscribed_at", "joined"]));
    for await (const subscriber of paged((skip) =>
      prisma.subscriber.findMany({
        where: { createdAt },
        orderBy: { createdAt: "asc" },
        skip,
        take: BATCH,
      }),
    )) {
      const status = subscriber.unsubscribedAt
        ? "unsubscribed"
        : subscriber.confirmedAt
          ? "confirmed"
          : "pending";
      res.write(row([subscriber.email, status, subscriber.confirmedAt, subscriber.unsubscribedAt, subscriber.createdAt]));
    }
  }
  res.end();
};

export const reportService = {
  getAnalytics,
  analyticsBetween,
  resolveRange,
  exportCsv,
};
