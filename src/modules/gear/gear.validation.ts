import { z } from "zod";
import {
  numericQueryField,
  paginationQueryFields,
  uuidField,
} from "../../utils/validationFields";

const gearItemFields = {
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name must be at most 120 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Description must be at most 2000 characters")
    .optional(),
  brand: z
    .string()
    .trim()
    .max(80, "Brand must be at most 80 characters")
    .optional(),
  imageUrl: z.url("Image URL must be a valid URL").optional(),
  pricePerDay: z
    .number("Price per day must be a number")
    .positive("Price per day must be greater than 0")
    .max(1000000, "Price per day is unrealistically high"),
  stock: z
    .number("Stock must be a number")
    .int("Stock must be a whole number")
    .nonnegative("Stock cannot be negative"),
  categoryId: uuidField("Category ID"),
};

const addGearItem = z.object(gearItemFields);

const updateGearItem = z
  .object({ ...gearItemFields, isAvailable: z.boolean() })
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    error: "Provide at least one field to update",
  });

const gearQuery = z.object({
  searchTerm: z.string().trim().max(100).optional(),
  category: uuidField("Category").optional(),
  brand: z.string().trim().max(80).optional(),
  minPrice: numericQueryField("Minimum price"),
  maxPrice: numericQueryField("Maximum price"),
  isAvailable: z
    .enum(["true", "false"], {
      error: "isAvailable must be either true or false",
    })
    .optional(),
  sortBy: z
    .enum(["name", "pricePerDay", "stock", "createdAt"], {
      error: "Cannot sort by that field",
    })
    .optional(),
  sortOrder: z
    .enum(["asc", "desc"], { error: "Sort order must be asc or desc" })
    .optional(),
  ...paginationQueryFields,
});

/** No price or brand filters — a provider is searching their own catalogue. */
const providerGearQuery = gearQuery.omit({
  brand: true,
  minPrice: true,
  maxPrice: true,
});

export const gearValidation = {
  addGearItem,
  updateGearItem,
  gearQuery,
  providerGearQuery,
};
