import { prisma } from "../../lib/prisma";
import { safeUserSelect } from "../../utils/userSelect";
import { IGetUsersQueryParams } from "./admin.interface";

const getAllUsers = async (query: IGetUsersQueryParams) => {
  const page = query.page ? Number(query.page) : 1;
  const limit = query.limit ? Number(query.limit) : 10;
  const skip = (page - 1) * limit;

  const where = {
    role: query.role ? (query.role as any) : undefined,
    status: query.status ? (query.status as any) : undefined,
  };

  const users = await prisma.user.findMany({
    where,
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
    select: safeUserSelect,
  });
  const totalCount = await prisma.user.count({
    where,
  });
  return {
    data: users,
    meta: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

export const adminService = {
  getAllUsers,
};
