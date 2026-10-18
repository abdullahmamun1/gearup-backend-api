import { z } from "zod";
import {
  dateKeyField,
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
  imageUrl: z
    .union([z.literal(""), z.url("Image URL must be a valid URL")])
    .optional(),
  images: z
    .array(z.url("Each gallery image must be a valid URL"))
    .max(8, "A listing can have at most 8 gallery images")
    .optional(),
  pricePerDay: z
    .number("Price per day must be a number")
    .positive("Price per day must be greater than 0")
    .max(1000000, "Price per day is unrealistically high"),
  depositAmount: z
    .number("Deposit must be a number")
    .nonnegative("Deposit cannot be negative")
    .max(1000000, "Deposit is unrealistically high")
    .optional(),
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

const gearIdParam = z.object({ gearId: uuidField("Gear ID") });

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
    .enum(["name", "pricePerDay", "stock", "createdAt", "featured"], {
      error: "Cannot sort by that field",
    })
    .optional(),
  sortOrder: z
    .enum(["asc", "desc"], { error: "Sort order must be asc or desc" })
    .optional(),
  /** Only gear with at least one unit free on every day of [from, to). */
  from: dateKeyField("From date").optional(),
  to: dateKeyField("To date").optional(),
  /** Providers in this city (case-insensitive). */
  city: z.string().trim().max(60).optional(),
  /** "lat,lng": gear within `radius` km of this point, nearest first. */
  near: z
    .string()
    .regex(/^-?\d{1,2}(\.\d+)?,-?\d{1,3}(\.\d+)?$/, "near must be lat,lng")
    .optional(),
  radius: z.coerce
    .number("radius must be a number")
    .min(1, "radius must be at least 1 km")
    .max(300, "radius must be at most 300 km")
    .optional(),
  ...paginationQueryFields,
});

/** No price or brand filters — a provider is searching their own catalogue. */
const providerGearQuery = gearQuery.omit({
  brand: true,
  minPrice: true,
  maxPrice: true,
  from: true,
  to: true,
  city: true,
  near: true,
  radius: true,
}).extend({
  sortBy: z
    .enum(["name", "pricePerDay", "stock", "createdAt"], {
      error: "Cannot sort by that field",
    })
    .optional(),
});

const availabilityQuery = z.object({
  from: dateKeyField("From date").optional(),
  to: dateKeyField("To date").optional(),
});

export const gearValidation = {
  addGearItem,
  updateGearItem,
  gearIdParam,
  gearQuery,
  providerGearQuery,
  availabilityQuery,
};
