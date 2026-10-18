import { z } from "zod";
import {
  RentalStatus,
  Role,
  UserStatus,
} from "../../../generated/prisma/enums";
import {
  paginationQueryFields,
  uuidField,
} from "../../utils/validationFields";

const updateUserStatus = z.object({
  status: z.enum(UserStatus, {
    error: "Status must be either ACTIVE or SUSPENDED",
  }),
});

const createCategory = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(60, "Category name must be at most 60 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be at most 500 characters")
    .optional(),
});

const updateCategory = createCategory
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    error: "Provide at least one field to update",
  });

const usersQuery = z.object({
  role: z.enum(Role, { error: "Unknown role" }).optional(),
  status: z.enum(UserStatus, { error: "Unknown status" }).optional(),
  ...paginationQueryFields,
});

const gearQuery = z.object({
  searchTerm: z
    .string()
    .trim()
    .max(100, "Search term must be at most 100 characters")
    .optional(),
  category: uuidField("Category ID").optional(),
  isAvailable: z
    .enum(["true", "false"], { error: "Availability must be true or false" })
    .optional(),
  ...paginationQueryFields,
});

const rentalsQuery = z.object({
  status: z.enum(RentalStatus, { error: "Unknown rental status" }).optional(),
  ...paginationQueryFields,
});

const reviewsQuery = z.object({
  visibility: z
    .enum(["visible", "hidden"], { error: "Visibility must be visible or hidden" })
    .optional(),
  rating: z.coerce
    .number("Rating must be a number")
    .int()
    .min(1, "Rating must be 1–5")
    .max(5, "Rating must be 1–5")
    .optional(),
  searchTerm: z
    .string()
    .trim()
    .max(100, "Search term must be at most 100 characters")
    .optional(),
  ...paginationQueryFields,
});

const reviewParams = z.object({ reviewId: uuidField("Review ID") });

const moderateReview = z.object({
  isHidden: z.boolean({ error: "isHidden must be true or false" }),
});

const gearParams = z.object({ gearId: uuidField("Gear ID") });

const featureGear = z.object({
  isFeatured: z.boolean({ error: "isFeatured must be true or false" }),
});

const subscribersQuery = z.object({
  status: z
    .enum(["confirmed", "pending", "unsubscribed"], { error: "Unknown status" })
    .optional(),
  searchTerm: z
    .string()
    .trim()
    .max(100, "Search term must be at most 100 characters")
    .optional(),
  ...paginationQueryFields,
});

export const adminValidation = {
  reviewsQuery,
  reviewParams,
  moderateReview,
  gearParams,
  featureGear,
  subscribersQuery,
  updateUserStatus,
  createCategory,
  updateCategory,
  usersQuery,
  gearQuery,
  rentalsQuery,
};
