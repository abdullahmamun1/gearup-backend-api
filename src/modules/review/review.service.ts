import { prisma } from "../../lib/prisma";
import { createError } from "../../utils/createError";
import { IGetQueryParams } from "../provider/provider.interface";
import { ICreateReviewInput } from "./review.interface";

const createReview = async (
  customerId: string,
  payload: ICreateReviewInput,
) => {
  const { rentalOrderId, gearItemId, rating, comment } = payload;
  if (!rentalOrderId || !gearItemId || rating) {
    throw createError(400, "rentalOrderId, gearItemId & rating are required");
  }
  if (typeof rating !== "number" || rating < 1 || rating > 5) {
    throw createError(400, "Rating must be a number between 1 and 5");
  }

  const order = await prisma.rentalOrder.findUnique({
    where: {
      id: rentalOrderId,
    },
    include: {
      items: true,
      review: true,
    },
  });
  if (!order) {
    throw createError(404, "Rental Order not found");
  }
  if (order.customerId !== customerId) {
    throw createError(403, "You do not own this order");
  }
  if (order.status !== "RETURNED") {
    throw createError(
      400,
      "You can only review gear after the order has been returned",
    );
  }
  const gearInOrder = order.items.some(
    (item) => item.gearItemId === gearItemId,
  );
  if (!gearInOrder) {
    throw createError(
      400,
      "This gear item was not part of the specified order",
    );
  }
  if (order.review) {
    throw createError(
      409,
      "A review has already been submitted for this order",
    );
  }

  const review = await prisma.review.create({
    data: {
      customerId,
      gearItemId,
      rentalOrderId,
      rating,
      comment,
    },
  });
  return review;
};

const getReviewsForGear = async (
  gearItemId: string,
  query: IGetQueryParams,
) => {
  const page = query.page ? Number(query.page) : 1;
  const limit = query.limit ? Number(query.limit) : 10;
  const skip = (page - 1) * limit;

  const reviews = await prisma.review.findMany({
    where: {
      gearItemId,
    },
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { id: true, name: true } } },
  });
  const totalCount = await prisma.review.count({
    where: {
      gearItemId,
    },
  });
  return {
    data: reviews,
    meta: {
      page: limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

export const reviewService = {
  createReview,
  getReviewsForGear,
};
