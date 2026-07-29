import { z } from "zod";
import { Role, UserStatus } from "../../../generated/prisma/enums";
import { paginationQueryFields } from "../../utils/validationFields";

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

export const adminValidation = {
  updateUserStatus,
  createCategory,
  updateCategory,
  usersQuery,
};
