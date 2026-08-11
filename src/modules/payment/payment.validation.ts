import { z } from "zod";
import { PaymentStatus } from "../../../generated/prisma/enums";
import { paginationQueryFields, uuidField } from "../../utils/validationFields";

const createPayment = z.object({
  orderId: uuidField("Order ID"),
});

const paymentQuery = z.object({
  status: z.enum(PaymentStatus, { error: "Unknown payment status" }).optional(),
  ...paginationQueryFields,
});

export const paymentValidation = {
  createPayment,
  paymentQuery,
};
