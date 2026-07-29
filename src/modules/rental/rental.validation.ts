import { z } from "zod";
import { RentalStatus } from "../../../generated/prisma/enums";
import {
  dateStringField,
  paginationQueryFields,
  uuidField,
} from "../../utils/validationFields";

const createOrder = z
  .object({
    items: z
      .array(
        z.object({
          gearItemId: uuidField("Gear item ID"),
          quantity: z
            .number("Quantity must be a number")
            .int("Quantity must be a whole number")
            .positive("Quantity must be at least 1"),
        }),
      )
      .min(1, "Add at least one gear item to the order"),
    startDate: dateStringField("Start date"),
    endDate: dateStringField("End date"),
  })
  .refine(
    (payload) => Date.parse(payload.endDate) > Date.parse(payload.startDate),
    {
      error: "End date must be after the start date",
      path: ["endDate"],
    },
  );

const orderQuery = z.object({
  status: z.enum(RentalStatus, { error: "Unknown rental status" }).optional(),
  ...paginationQueryFields,
});

export const rentalValidation = {
  createOrder,
  orderQuery,
};
