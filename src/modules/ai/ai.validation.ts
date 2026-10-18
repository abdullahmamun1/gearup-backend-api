import { z } from "zod";
import { Locale } from "../../../generated/prisma/enums";
import { dateKeyField } from "../../utils/validationFields";

/** The interface language: replies and drafts are written in it. */
const locale = z.enum(Locale, { error: "Language must be en or bn" }).optional();

const message = z.object({
  role: z.enum(["user", "assistant"], { error: "Unknown message role" }),
  content: z
    .string()
    .trim()
    .min(1, "Messages can't be empty")
    .max(500, "Keep each message under 500 characters"),
});

const gearFinder = z
  .object({
    messages: z
      .array(message)
      .min(1, "Say what you're planning")
      .max(10, "That's a long chat — start a new one to keep going"),
    from: dateKeyField("Start date").optional(),
    to: dateKeyField("End date").optional(),
    locale,
  })
  .refine((body) => body.messages.at(-1)?.role === "user", {
    error: "The last message must be yours",
  });

const listingDraft = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Give the item a name first")
    .max(100, "Name must be at most 100 characters"),
  brand: z.string().trim().max(60).optional(),
  categoryId: z.uuid("Invalid category").optional(),
  notes: z
    .string()
    .trim()
    .max(600, "Keep notes under 600 characters")
    .optional(),
  imageUrl: z.url("Invalid image URL").optional(),
  locale,
});

const searchSuggest = z.object({
  q: z
    .string()
    .trim()
    .min(3, "Type a few more letters")
    .max(120, "Keep the search under 120 characters"),
  locale,
});

export const aiValidation = { gearFinder, listingDraft, searchSuggest };
