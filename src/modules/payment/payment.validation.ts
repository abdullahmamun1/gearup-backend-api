import { z } from "zod";
import { paginationQueryFields, uuidField } from "../../utils/validationFields";

const createPayment = z.object({
  orderId: uuidField("Order ID"),
});

const paymentQuery = z.object({ ...paginationQueryFields });

export const paymentValidation = {
  createPayment,
  paymentQuery,
};
