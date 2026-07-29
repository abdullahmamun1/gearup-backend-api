import { z } from "zod";
import { RentalStatus } from "../../../generated/prisma/enums";
import { paginationQueryFields } from "../../utils/validationFields";

const updateOrderStatus = z.object({
  status: z.enum(RentalStatus, { error: "Unknown rental status" }),
});

const orderQuery = z.object({ ...paginationQueryFields });

export const providerValidation = {
  updateOrderStatus,
  orderQuery,
};
