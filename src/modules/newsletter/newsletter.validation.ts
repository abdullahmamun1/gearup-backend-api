import { z } from "zod";
import { Locale } from "../../../generated/prisma/enums";

const subscribe = z.object({
  email: z.email("Enter a valid email address"),
  /** The page language, for the emails that follow. */
  locale: z.enum(Locale, { error: "Language must be en or bn" }).optional(),
});

const token = z.object({
  token: z.string().min(20, "This link is invalid").max(200, "This link is invalid"),
});

export const newsletterValidation = { subscribe, token };
