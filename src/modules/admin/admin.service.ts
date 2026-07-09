import { RentalStatus, UserStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { createError } from "../../utils/createError";
import { safeUserSelect } from "../../utils/userSelect";
import { IGetQueryParams } from "../provider/provider.interface";
import {
  ICreateRentalOrderInput,
  IGetOrderQueryParams,
} from "../rental/rental.interface";
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
  if (!["ACTIVE", "SUSPENDED"].includes(status)) {
    throw createError(400, "status must be ACTIVE or SUSPENDED");
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

const getAllGear = async (query: IGetQueryParams) => {
  const page = query.page ? Number(query.page) : 1;
  const limit = query.limit ? Number(query.limit) : 10;
  const skip = (page - 1) * limit;

  const gear = await prisma.gearItem.findMany({
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      category: true,
      provider: { select: { id: true, name: true, email: true } },
    },
  });
  const totalCount = await prisma.gearItem.count();
  return {
    data: gear,
    meta: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

const getAllRentals = async (query: IGetOrderQueryParams) => {
  const page = query.page ? Number(query.page) : 1;
  const limit = query.limit ? Number(query.limit) : 10;
  const skip = (page - 1) * limit;

  const where = {
    status: query.status ? (query.status as RentalStatus) : undefined,
  };

  const rentals = await prisma.rentalOrder.findMany({
    where,
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      items: { include: { gearItem: true } },
      payments: true,
    },
  });
  const totalCount = await prisma.rentalOrder.count({ where });
  return {
    data: rentals,
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
  updateUserStatus,
  getAllGear,
  getAllRentals,
};
