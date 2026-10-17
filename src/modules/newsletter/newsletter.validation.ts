import { z } from "zod";

const subscribe = z.object({
  email: z.email("Enter a valid email address"),
});

const token = z.object({
  token: z.string().min(20, "This link is invalid").max(200, "This link is invalid"),
});

export const newsletterValidation = { subscribe, token };
