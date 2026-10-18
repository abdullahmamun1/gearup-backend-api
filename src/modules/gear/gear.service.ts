import { GearItemWhereInput } from "../../../generated/prisma/models";
import { prisma } from "../../lib/prisma";
import { createError } from "../../utils/createError";
import { assertEmailVerified } from "../auth/auth.service";
import { addDays, daysBetween, parseDateKey, today } from "../../utils/dates";
import {
  approximate,
  boundingBox,
  haversineKm,
  parseLatLng,
} from "../../utils/geo";
import { rentalAvailability } from "../rental/rental.availability";
import { RENTAL_POLICY } from "../rental/rental.policy";
import {
  IAvailabilityQueryParams,
  IGearQueryParams,
  IAddGearItemPayload,
  IProviderGearQueryParams,
  IUpdateGearItemPayload,
} from "./gear.interface";

/** Search radius when `near` is given without one. */
const DEFAULT_RADIUS_KM = 25;

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

  if (query.city) {
    andConditions.push({
      provider: { city: { equals: query.city, mode: "insensitive" } },
    });
  }
  const near = parseLatLng(query.near);
  const radiusKm = query.radius ?? DEFAULT_RADIUS_KM;
  if (near) {
    // Cheap box first; the exact distance is checked below.
    const box = boundingBox(near, radiusKm);
    andConditions.push({
      provider: {
        latitude: { gte: box.minLat, lte: box.maxLat },
        longitude: { gte: box.minLng, lte: box.maxLng },
      },
    });
  }

  const where: GearItemWhereInput = { AND: andConditions };
  // "featured": admin-picked gear first, then newest.
  const orderBy =
    sortBy === "featured"
      ? [{ isFeatured: "desc" as const }, { createdAt: "desc" as const }]
      : { [sortBy]: sortOrder };
  const include = {
    category: true,
    provider: {
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        city: true,
        area: true,
        latitude: true,
        longitude: true,
      },
    },
  };

  let gearItems;
  let totalCount;
  const distanceById = new Map<string, number>();
  const range = parseDateRange(query.from, query.to);
  if (range || near) {
    // Availability depends on bookings and distance on maths, not columns,
    // so filter the matches in memory, then paginate what's left.
    const candidates = await prisma.gearItem.findMany({
      where,
      orderBy,
      select: {
        id: true,
        stock: true,
        isAvailable: true,
        provider: { select: { latitude: true, longitude: true } },
      },
    });
    let matches = candidates;
    if (range) {
      const free = await rentalAvailability.availableUnits(
        prisma,
        candidates,
        range.from,
        range.to,
      );
      matches = matches.filter((gear) => (free.get(gear.id) ?? 0) > 0);
    }
    if (near) {
      for (const gear of matches) {
        const { latitude, longitude } = gear.provider;
        if (latitude !== null && longitude !== null) {
          distanceById.set(gear.id, haversineKm(near, { latitude, longitude }));
        }
      }
      matches = matches
        .filter((gear) => (distanceById.get(gear.id) ?? Infinity) <= radiusKm)
        // Nearest first; ties keep the requested sort order.
        .sort((a, b) => distanceById.get(a.id)! - distanceById.get(b.id)!);
    }
    const ids = matches.map((gear) => gear.id);
    const pageIds = ids.slice(skip, skip + limit);
    const rows = await prisma.gearItem.findMany({
      where: { id: { in: pageIds } },
      include,
      omit: { reviewSummary: true },
    });
    const rowById = new Map(rows.map((row) => [row.id, row]));
    gearItems = pageIds.map((id) => rowById.get(id)!).filter(Boolean);
    totalCount = ids.length;
  } else {
    [gearItems, totalCount] = await Promise.all([
      prisma.gearItem.findMany({
        where,
        take: limit,
        skip,
        orderBy,
        include,
        // The review digest is for the detail page only.
        omit: { reviewSummary: true },
      }),
      prisma.gearItem.count({ where }),
    ]);
  }

  const ratings = await prisma.review.groupBy({
    by: ["gearItemId"],
    where: {
      gearItemId: { in: gearItems.map((item) => item.id) },
      isHidden: false,
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
      provider: publicProvider(item.provider),
      rating: ratingByGear.get(item.id) ?? { average: null, count: 0 },
      ...(distanceById.has(item.id) && {
        distanceKm: Math.round(distanceById.get(item.id)! * 10) / 10,
      }),
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
          email: true, avatarUrl: true, city: true, area: true, latitude: true, longitude: true,
        },
      },
    },
  });
  if (!gearItem) {
    throw createError(404, "Gear item not found");
  }
  return { ...gearItem, provider: publicProvider(gearItem.provider) };
};

/**
 * Swap a provider's exact pickup point for an approximate one before it
 * leaves the API publicly.
 */
const publicProvider = <
  T extends { latitude: number | null; longitude: number | null },
>({
  latitude,
  longitude,
  ...provider
}: T) => ({
  ...provider,
  location: approximate(latitude, longitude),
});

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
  await assertEmailVerified(providerId);

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

/** Gear with category, provider and rating: the shape GearCard expects. */
const getGearCards = async (ids: string[]) => {
  if (ids.length === 0) return [];
  const [rows, ratings] = await Promise.all([
    prisma.gearItem.findMany({
      where: { id: { in: ids } },
      include: {
        category: true,
        provider: { select: { id: true, name: true, avatarUrl: true, city: true } },
      },
      omit: { reviewSummary: true },
    }),
    prisma.review.groupBy({
      by: ["gearItemId"],
      where: { gearItemId: { in: ids }, isHidden: false },
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ]);
  const ratingById = new Map(
    ratings.map((row) => [
      row.gearItemId,
      { average: row._avg.rating, count: row._count.rating },
    ]),
  );
  const rowById = new Map(rows.map((row) => [row.id, row]));
  // Keep the AI's order: it ranks the best fit first.
  return ids
    .map((id) => rowById.get(id))
    .filter((row) => row !== undefined)
    .map((row) => ({
      ...row,
      rating: ratingById.get(row.id) ?? { average: null, count: 0 },
    }));
};

export const gearService = {
  getGearCards,
  parseDateRange,
  getAllGearItems,
  getGearItemById,
  getGearAvailability,
  getAllBrands,
  getProviderGearItems,
  addGearItem,
  updateGearItem,
  deleteGearItem,
};
