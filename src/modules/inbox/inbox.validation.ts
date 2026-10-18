import { z } from "zod";
import { ContactStatus } from "../../../generated/prisma/enums";
import {
  paginationQueryFields,
  uuidField,
} from "../../utils/validationFields";

const inboxQuery = z.object({
  status: z.enum(ContactStatus, { error: "Unknown status" }).optional(),
  searchTerm: z
    .string()
    .trim()
    .max(100, "Search term must be at most 100 characters")
    .optional(),
  ...paginationQueryFields,
});

const messageParams = z.object({ messageId: uuidField("Message ID") });

const updateStatus = z.object({
  /** Archive, or move back to the inbox. Replying sets REPLIED. */
  archived: z.boolean({ error: "archived must be true or false" }),
});

const reply = z.object({
  body: z
    .string()
    .trim()
    .min(10, "Write a reply of at least 10 characters")
    .max(5000, "Reply must be at most 5000 characters"),
});

export const inboxValidation = {
  inboxQuery,
  messageParams,
  updateStatus,
  reply,
};
