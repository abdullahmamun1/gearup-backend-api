import { z } from "zod";
import { paginationQueryFields, uuidField } from "../../utils/validationFields";

const createReview = z.object({
  rentalOrderId: uuidField("Rental order ID"),
  gearItemId: uuidField("Gear item ID"),
  rating: z
    .number("Rating must be a number")
    .int("Rating must be a whole number")
    .min(1, "Rating must be between 1 and 5")
    .max(5, "Rating must be between 1 and 5"),
  comment: z
    .string()
    .trim()
    .max(1000, "Comment must be at most 1000 characters")
    .optional(),
});

const reviewQuery = z.object({ ...paginationQueryFields });

export const reviewValidation = {
  createReview,
  reviewQuery,
};
