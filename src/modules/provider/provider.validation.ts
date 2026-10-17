import { z } from "zod";
import { RentalStatus } from "../../../generated/prisma/enums";
import { paginationQueryFields } from "../../utils/validationFields";

const updateOrderStatus = z
  .object({
    status: z.enum(
      [
        RentalStatus.CONFIRMED,
        RentalStatus.CANCELLED,
        RentalStatus.PICKED_UP,
        RentalStatus.RETURNED,
      ],
      { error: "Status must be CONFIRMED, CANCELLED, PICKED_UP or RETURNED" },
    ),
    /** Why the order was declined, or what was damaged. */
    note: z.string().trim().max(500, "Keep the note under 500 characters").optional(),
    /** Only for RETURNED orders that hold a deposit. */
    condition: z
      .enum(["OK", "DAMAGED"], { error: "Condition must be OK or DAMAGED" })
      .optional(),
    damageAmount: z
      .number("Damage amount must be a number")
      .positive("Damage amount must be greater than 0")
      .optional(),
  })
  .refine(
    (payload) =>
      payload.condition !== "DAMAGED" ||
      (payload.damageAmount !== undefined && !!payload.note),
    {
      error: "Describe the damage and enter the amount to claim",
      path: ["damageAmount"],
    },
  );

const orderQuery = z.object({
  status: z.enum(RentalStatus, { error: "Unknown rental status" }).optional(),
  ...paginationQueryFields,
});

export const providerValidation = {
  updateOrderStatus,
  orderQuery,
};
