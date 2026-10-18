import { z } from "zod";
import { uuidField } from "../../utils/validationFields";

const orderParams = z.object({ orderId: uuidField("Order id") });

const sendMessage = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write a message first")
    .max(2000, "Messages can be at most 2000 characters"),
});

export const messageValidation = { orderParams, sendMessage };
