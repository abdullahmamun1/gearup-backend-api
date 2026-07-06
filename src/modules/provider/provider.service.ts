import { prisma } from "../../../lib/prisma";
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

export const providerService = {
  getProviderOrders,
};
