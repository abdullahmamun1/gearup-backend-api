import { UserStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { createError } from "../../utils/createError";
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
const updateUserStatus = async (
  targetUserId: string,
  requesterId: string,
  status: UserStatus,
) => {
  if (![UserStatus.ACTIVE, UserStatus.SUSPENDED].includes(status)) {
    throw createError(400, "Status must be ACTIVE or SUSPENDED");
  }
  if (targetUserId === requesterId) {
    throw createError(400, "You cannot change your own account status");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });
  if (!targetUser) {
    throw createError(404, "User not found");
  }
  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { status },
    select: safeUserSelect,
  });
  return updatedUser;
};

export const adminService = {
  getAllUsers,
  updateUserStatus,
};
