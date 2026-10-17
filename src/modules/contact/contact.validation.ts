import { z } from "zod";

const createMessage = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be at most 80 characters"),
  email: z.email("Enter a valid email address"),
  subject: z
    .string()
    .trim()
    .max(120, "Subject must be at most 120 characters")
    .optional(),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(2000, "Message must be at most 2000 characters"),
});

export const contactValidation = { createMessage };
