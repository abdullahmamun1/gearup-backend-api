import { RentalStatus, UserStatus } from "../../../generated/prisma/enums";
import { Prisma } from "../../../generated/prisma/client";
import { GearItemWhereInput } from "../../../generated/prisma/models";
import { prisma } from "../../lib/prisma";
import { createError } from "../../utils/createError";
import { safeUserSelect } from "../../utils/userSelect";
import { emailService } from "../email/email.service";
import { orderInclude, rentalService } from "../rental/rental.service";
import { IGetQueryParams } from "../provider/provider.interface";
import {
  ICreateRentalOrderInput,
  IGetOrderQueryParams,
} from "../rental/rental.interface";
import { aiService } from "../ai/ai.service";
import {
  IGetAdminGearQueryParams,
  IGetAdminReviewsQueryParams,
  IGetSubscribersQueryParams,
  IGetUsersQueryParams,
} from "./admin.interface";

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
  if (targetUser.status === status) {
    return prisma.user.findUniqueOrThrow({
      where: { id: targetUserId },
      select: safeUserSelect,
    });
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: targetUserId },
      data: { status },
      select: safeUserSelect,
    });
    await emailService.enqueue(tx, [
      {
        to: user.email,
        template: "accountStatus",
        payload: { name: user.name, status },
      },
    ]);
    return user;
  });
  emailService.dispatchSoon();
  return updatedUser;
};

const getAllGear = async (query: IGetAdminGearQueryParams) => {
  const page = query.page ? Number(query.page) : 1;
  const limit = query.limit ? Number(query.limit) : 10;
  const skip = (page - 1) * limit;

  const where: GearItemWhereInput = {};

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

  const gear = await prisma.gearItem.findMany({
    where,
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      category: true,
      provider: { select: { id: true, name: true, email: true } },
    },
  });
  const totalCount = await prisma.gearItem.count({ where });
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
  await rentalService.expireStaleOrders();

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
    include: { ...orderInclude, payments: true },
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

const pageOf = (query: { page?: string; limit?: string }) => {
  const page = query.page ? Number(query.page) : 1;
  const limit = query.limit ? Number(query.limit) : 10;
  return { page, limit, skip: (page - 1) * limit };
};

const getAllReviews = async (query: IGetAdminReviewsQueryParams) => {
  const { page, limit, skip } = pageOf(query);
  const where: Prisma.ReviewWhereInput = {
    ...(query.visibility && { isHidden: query.visibility === "hidden" }),
    ...(query.rating !== undefined && { rating: query.rating }),
    ...(query.searchTerm && {
      OR: [
        { comment: { contains: query.searchTerm, mode: "insensitive" } },
        { gearItem: { name: { contains: query.searchTerm, mode: "insensitive" } } },
        { customer: { name: { contains: query.searchTerm, mode: "insensitive" } } },
      ],
    }),
  };
  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        gearItem: {
          select: { id: true, name: true, imageUrl: true, images: true },
        },
      },
    }),
    prisma.review.count({ where }),
  ]);
  return {
    data: reviews,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

/** Hide or restore a review; ratings and the AI summary follow. */
const moderateReview = async (reviewId: string, isHidden: boolean) => {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw createError(404, "Review not found");
  if (review.isHidden === isHidden) return review;

  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: { isHidden, hiddenAt: isHidden ? new Date() : null },
  });
  aiService.summarizeReviewsSoon(review.gearItemId, true);
  return updated;
};

const setGearFeatured = async (gearId: string, isFeatured: boolean) => {
  const gear = await prisma.gearItem.findUnique({
    where: { id: gearId },
    select: { id: true },
  });
  if (!gear) throw createError(404, "Gear not found");
  return prisma.gearItem.update({
    where: { id: gearId },
    data: { isFeatured },
    select: { id: true, name: true, isFeatured: true },
  });
};

const getSubscribers = async (query: IGetSubscribersQueryParams) => {
  const { page, limit, skip } = pageOf(query);
  const where: Prisma.SubscriberWhereInput = {
    ...(query.status === "confirmed" && {
      confirmedAt: { not: null },
      unsubscribedAt: null,
    }),
    ...(query.status === "pending" && { confirmedAt: null, unsubscribedAt: null }),
    ...(query.status === "unsubscribed" && { unsubscribedAt: { not: null } }),
    ...(query.searchTerm && {
      email: { contains: query.searchTerm, mode: "insensitive" },
    }),
  };
  const [subscribers, total, counts] = await Promise.all([
    prisma.subscriber.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      // The token is a credential (it unsubscribes); never send it out.
      select: {
        id: true,
        email: true,
        confirmedAt: true,
        unsubscribedAt: true,
        createdAt: true,
      },
    }),
    prisma.subscriber.count({ where }),
    Promise.all([
      prisma.subscriber.count({
        where: { confirmedAt: { not: null }, unsubscribedAt: null },
      }),
      prisma.subscriber.count({ where: { confirmedAt: null, unsubscribedAt: null } }),
      prisma.subscriber.count({ where: { unsubscribedAt: { not: null } } }),
    ]),
  ]);
  return {
    data: subscribers,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    counts: { confirmed: counts[0], pending: counts[1], unsubscribed: counts[2] },
  };
};

export const adminService = {
  getAllReviews,
  moderateReview,
  setGearFeatured,
  getSubscribers,
  getAllUsers,
  updateUserStatus,
  getAllGear,
  getAllRentals,
};
