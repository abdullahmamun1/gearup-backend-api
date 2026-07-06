import { GearItemWhereInput } from "../../../generated/prisma/models";
import { prisma } from "../../../lib/prisma";
import { IGearQueryParams } from "./gear.interface";

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

  const gearItems = await prisma.gearItem.findMany({
    //dynamic searching, filtering
    where: {
      AND: andConditions,
    },
    //dynamic sorting, pagination
    take: limit,
    skip: skip,
    orderBy: {
      [sortBy]: sortOrder,
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
  const totalCount = await prisma.gearItem.count({
    where: {
      AND: andConditions,
    },
  });
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
  return gearItem;
};

export const gearService = {
  getAllGearItems,
  getGearItemById,
};
