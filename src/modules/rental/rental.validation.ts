import { z } from "zod";
import { RentalStatus } from "../../../generated/prisma/enums";
import {
  dateKeyField,
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
            .positive("Quantity must be at least 1")
            .max(50, "Quantity must be at most 50"),
        }),
      )
      .min(1, "Add at least one gear item to the order")
      .max(10, "An order can have at most 10 lines"),
    startDate: dateKeyField("Start date"),
    endDate: dateKeyField("End date"),
  })
  .refine(
    (payload) => payload.endDate > payload.startDate,
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
