import { z } from "zod";
import {
  paginationQueryFields,
  uuidField,
} from "../../utils/validationFields";

const claimsQuery = z.object({
  status: z
    .enum(["open", "resolved"], { error: "Status must be open or resolved" })
    .optional(),
  ...paginationQueryFields,
});

const orderParams = z.object({ orderId: uuidField("Order ID") });

const resolveClaim = z.object({
  keepAmount: z
    .number({ error: "Enter the amount to keep" })
    .min(0, "The amount kept can't be negative")
    .max(1_000_000, "That amount is too large"),
  note: z
    .string()
    .trim()
    .max(500, "Note must be at most 500 characters")
    .optional(),
});

export const claimValidation = { claimsQuery, orderParams, resolveClaim };
