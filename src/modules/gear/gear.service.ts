import { GearItemWhereInput } from "../../../generated/prisma/models";
import { prisma } from "../../lib/prisma";
import { createError } from "../../utils/createError";
import { addDays, daysBetween, parseDateKey, today } from "../../utils/dates";
import { rentalAvailability } from "../rental/rental.availability";
import { RENTAL_POLICY } from "../rental/rental.policy";
import {
  IAvailabilityQueryParams,
  IGearQueryParams,
  IAddGearItemPayload,
  IProviderGearQueryParams,
  IUpdateGearItemPayload,
} from "./gear.interface";

const getAllGearItems = async (query: IGearQueryParams) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder || "desc";

  const andConditions: GearItemWhereInput[] = [];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: query.searchTerm, mode: "insensitive" } },
        { description: { contains: query.searchTerm, mode: "insensitive" } },
        { brand: { contains: query.searchTerm, mode: "insensitive" } },
      ],
    });
  }
  if (query.category) {
    andConditions.push({
      categoryId: query.category,
    });
  }
  if (query.brand) {
    andConditions.push({
      brand: {
        equals: query.brand,
        mode: "insensitive",
      },
    });
  }
  if (query.minPrice || query.maxPrice) {
    andConditions.push({
      pricePerDay: {
        gte: query.minPrice ? Number(query.minPrice) : undefined,
        lte: query.maxPrice ? Number(query.maxPrice) : undefined,
      },
    });
  }
  if (query.isAvailable !== undefined) {
    andConditions.push({
      isAvailable: query.isAvailable === "true",
    });
  }

  const where: GearItemWhereInput = { AND: andConditions };
  const orderBy = { [sortBy]: sortOrder };
  const include = {
    category: true,
    provider: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
  };

  let gearItems;
  let totalCount;
  const range = parseDateRange(query.from, query.to);
  if (range) {
    // Availability depends on bookings, not columns, so filter in memory:
    // every match's free units for the range, then paginate what's left.
    const candidates = await prisma.gearItem.findMany({
      where,
      orderBy,
      select: { id: true, stock: true, isAvailable: true },
    });
    const free = await rentalAvailability.availableUnits(
      prisma,
      candidates,
      range.from,
      range.to,
    );
    const ids = candidates
      .filter((gear) => (free.get(gear.id) ?? 0) > 0)
      .map((gear) => gear.id);
    const pageIds = ids.slice(skip, skip + limit);
    const rows = await prisma.gearItem.findMany({
      where: { id: { in: pageIds } },
      include,
    });
    const rowById = new Map(rows.map((row) => [row.id, row]));
    gearItems = pageIds.map((id) => rowById.get(id)!).filter(Boolean);
    totalCount = ids.length;
  } else {
    [gearItems, totalCount] = await Promise.all([
      prisma.gearItem.findMany({ where, take: limit, skip, orderBy, include }),
      prisma.gearItem.count({ where }),
    ]);
  }

  const ratings = await prisma.review.groupBy({
    by: ["gearItemId"],
    where: {
      gearItemId: { in: gearItems.map((item) => item.id) },
    },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const ratingByGear = new Map(
    ratings.map((row) => [
      row.gearItemId,
      { average: row._avg.rating, count: row._count.rating },
    ]),
  );

  return {
    data: gearItems.map((item) => ({
      ...item,
      rating: ratingByGear.get(item.id) ?? { average: null, count: 0 },
    })),
    meta: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

/** Both dates or neither; a bad pair is the caller's mistake (400). */
const parseDateRange = (fromKey?: string, toKey?: string) => {
  if (!fromKey && !toKey) return null;
  if (!fromKey || !toKey) {
    throw createError(400, "Pick both a start and an end date");
  }
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  const days = daysBetween(from, to);
  if (days < 1) {
    throw createError(400, "The end date must be after the start date");
  }
  if (days > RENTAL_POLICY.maxRentalDays) {
    throw createError(
      400,
      `Rentals can be at most ${RENTAL_POLICY.maxRentalDays} days long`,
    );
  }
  return { from, to };
};

const CALENDAR_DEFAULT_DAYS = 90;
const CALENDAR_MAX_DAYS = 186;

const getGearAvailability = async (
  gearId: string,
  query: IAvailabilityQueryParams,
) => {
  const from = query.from ? parseDateKey(query.from) : today();
  const to = query.to
    ? parseDateKey(query.to)
    : addDays(from, CALENDAR_DEFAULT_DAYS);
  const days = daysBetween(from, to);
  if (days < 1 || days > CALENDAR_MAX_DAYS) {
    throw createError(
      400,
      `Pick a range between 1 and ${CALENDAR_MAX_DAYS} days`,
    );
  }
  return rentalAvailability.getCalendar(gearId, from, to);
};

const getGearItemById = async (gearId: string) => {
  const gearItem = await prisma.gearItem.findUnique({
    where: {
      id: gearId,
    },
    include: {
      category: true,
      provider: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
  if (!gearItem) {
    throw createError(404, "Gear item not found");
  }
  return gearItem;
};

const getAllBrands = async () => {
  const rows = await prisma.gearItem.findMany({
    where: { brand: { not: null } },
    distinct: ["brand"],
    select: { brand: true },
    orderBy: { brand: "asc" },
  });
  return rows
    .map((row) => row.brand?.trim())
    .filter((brand): brand is string => Boolean(brand));
};

const getProviderGearItems = async (
  providerId: string,
  query: IProviderGearQueryParams,
) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder || "desc";

  const where: GearItemWhereInput = { providerId };

  if (query.searchTerm) {
    where.OR = [
      { name: { contains: query.searchTerm, mode: "insensitive" } },
      { brand: { contains: query.searchTerm, mode: "insensitive" } },
    ];
  }
  if (query.category) {
    where.categoryId = query.category;
  }
  if (query.isAvailable !== undefined) {
    where.isAvailable = query.isAvailable === "true";
  }

  const gearItems = await prisma.gearItem.findMany({
    where,
    take: limit,
    skip,
    orderBy: { [sortBy]: sortOrder },
    include: {
      category: true,
      _count: { select: { orderItems: true, reviews: true } },
    },
  });
  const totalCount = await prisma.gearItem.count({ where });

  return {
    data: gearItems,
    meta: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

const addGearItem = async (
  providerId: string,
  payload: IAddGearItemPayload,
) => {
  const category = await prisma.category.findUnique({
    where: {
      id: payload.categoryId,
    },
  });
  if (!category) {
    throw createError(400, "Category not found");
  }
  const result = await prisma.gearItem.create({
    data: {
      ...payload,
      providerId,
    },
  });
  return result;
};

const getGearOwnedInfo = async (providerId: string, gearId: string) => {
  const gearItem = await prisma.gearItem.findUnique({
    where: {
      id: gearId,
    },
  });
  if (!gearItem) {
    throw createError(404, "Gear item not found");
  }
  if (gearItem.providerId !== providerId) {
    throw createError(
      403,
      "You do not have permission to access this resource",
    );
  }
  return gearItem;
};

const updateGearItem = async (
  providerId: string,
  gearId: string,
  payload: IUpdateGearItemPayload,
) => {
  await getGearOwnedInfo(providerId, gearId);
  const categoryId = payload.categoryId;
  if (categoryId) {
    const category = await prisma.category.findUnique({
      where: {
        id: categoryId,
      },
    });
    if (!category) {
      throw createError(400, "Category not found");
    }
  }
  const result = await prisma.gearItem.update({
    where: {
      id: gearId,
    },
    data: payload,
  });
  return result;
};

const deleteGearItem = async (providerId: string, gearId: string) => {
  await getGearOwnedInfo(providerId, gearId);
  const activeOrderCount = await prisma.orderItem.count({
    where: {
      gearItemId: gearId,
      rentalOrder: {
        status: { in: ["PLACED", "CONFIRMED", "PAID", "PICKED_UP"] },
      },
    },
  });
  if (activeOrderCount > 0) {
    throw createError(400, "Cannot delete gear item with active orders");
  }
  await prisma.gearItem.delete({
    where: {
      id: gearId,
    },
  });
};

export const gearService = {
  getAllGearItems,
  getGearItemById,
  getGearAvailability,
  getAllBrands,
  getProviderGearItems,
  addGearItem,
  updateGearItem,
  deleteGearItem,
};
