import { Prisma } from "../../../generated/prisma/client";
import { RentalStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { createError } from "../../utils/createError";
import { addDays, daysBetween, toDateKey, today } from "../../utils/dates";
import { holdsStockWhere } from "./rental.policy";

type Db = typeof prisma | Prisma.TransactionClient;

type RentableGear = { id: string; stock: number; isAvailable: boolean };

/**
 * Units booked on each day of [from, to), per gear item.
 *
 * A PICKED_UP order whose end date has passed is overdue: the gear isn't back
 * yet, so it keeps holding its units through today.
 */
const bookedPerDay = async (
  db: Db,
  gearIds: string[],
  from: Date,
  to: Date,
  now: Date,
) => {
  const dayCount = daysBetween(from, to);
  const booked = new Map<string, number[]>(
    gearIds.map((id) => [id, new Array<number>(dayCount).fill(0)]),
  );
  if (gearIds.length === 0 || dayCount <= 0) return booked;

  const items = await db.orderItem.findMany({
    where: {
      gearItemId: { in: gearIds },
      rentalOrder: {
        AND: [
          holdsStockWhere(now),
          { startDate: { lt: to } },
          {
            OR: [
              { endDate: { gt: from } },
              { status: RentalStatus.PICKED_UP },
            ],
          },
        ],
      },
    },
    select: {
      gearItemId: true,
      quantity: true,
      rentalOrder: { select: { startDate: true, endDate: true, status: true } },
    },
  });

  const tomorrow = addDays(today(now), 1);
  for (const item of items) {
    const { startDate, endDate, status } = item.rentalOrder;
    const effectiveEnd =
      status === RentalStatus.PICKED_UP && endDate < tomorrow
        ? tomorrow
        : endDate;

    const first = Math.max(0, daysBetween(from, startDate));
    const last = Math.min(dayCount, daysBetween(from, effectiveEnd));
    const days = booked.get(item.gearItemId)!;
    for (let day = first; day < last; day++) {
      days[day]! += item.quantity;
    }
  }
  return booked;
};

/** Fewest units free on any day of [from, to), per gear item. */
const availableUnits = async (
  db: Db,
  gears: RentableGear[],
  from: Date,
  to: Date,
  now = new Date(),
) => {
  const booked = await bookedPerDay(
    db,
    gears.map((gear) => gear.id),
    from,
    to,
    now,
  );
  return new Map(
    gears.map((gear) => {
      if (!gear.isAvailable) return [gear.id, 0];
      const peak = Math.max(0, ...booked.get(gear.id)!);
      return [gear.id, Math.max(gear.stock - peak, 0)];
    }),
  );
};

/** Per-day free units for the booking calendar. */
const getCalendar = async (gearId: string, from: Date, to: Date) => {
  const gear = await prisma.gearItem.findUnique({
    where: { id: gearId },
    select: { id: true, stock: true, isAvailable: true },
  });
  if (!gear) {
    throw createError(404, "Gear item not found");
  }

  const booked = await bookedPerDay(prisma, [gear.id], from, to, new Date());
  const days = booked.get(gear.id)!.map((units, index) => ({
    date: toDateKey(addDays(from, index)),
    available: gear.isAvailable ? Math.max(gear.stock - units, 0) : 0,
  }));

  return { gearItemId: gear.id, stock: gear.stock, from: toDateKey(from), to: toDateKey(to), days };
};

/**
 * Locks the gear rows, then checks every item still has enough free units.
 * Must run inside the transaction that creates the order: the row lock makes
 * concurrent bookings of the same gear take turns, so they can't oversell.
 */
const lockAndAssertAvailable = async (
  tx: Prisma.TransactionClient,
  items: { gear: RentableGear & { name: string }; quantity: number }[],
  from: Date,
  to: Date,
) => {
  const ids = items.map((item) => item.gear.id).sort();
  await tx.$queryRaw`SELECT "id" FROM "gear_items" WHERE "id" = ANY(${ids}) FOR UPDATE`;

  const free = await availableUnits(
    tx,
    items.map((item) => item.gear),
    from,
    to,
  );
  for (const { gear, quantity } of items) {
    const units = free.get(gear.id) ?? 0;
    if (units < quantity) {
      throw createError(
        409,
        units === 0
          ? `${gear.name} is fully booked for those dates`
          : `Only ${units} of ${gear.name} left for those dates`,
      );
    }
  }
};

export const rentalAvailability = {
  availableUnits,
  getCalendar,
  lockAndAssertAvailable,
};
