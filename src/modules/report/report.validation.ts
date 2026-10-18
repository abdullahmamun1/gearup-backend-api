import { z } from "zod";
import { Locale } from "../../../generated/prisma/enums";
import { dateKeyField } from "../../utils/validationFields";

const range = z
  .object({
    from: dateKeyField("From date").optional(),
    to: dateKeyField("To date").optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    error: "The start date must be before the end date",
  });

const exportParams = z.object({
  type: z.enum(["users", "rentals", "payments", "subscribers"], {
    error: "Unknown export",
  }),
});

const insightsQuery = z
  .object({
    from: dateKeyField("From date").optional(),
    to: dateKeyField("To date").optional(),
    locale: z.enum(Locale, { error: "Language must be en or bn" }).optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    error: "The start date must be before the end date",
  });

export const reportValidation = { range, exportParams, insightsQuery };
