import { z } from "zod";

export const uuidField = (label: string) =>
  z.uuid(`${label} must be a valid ID`);

export const numericQueryField = (label: string) =>
  z
    .string()
    .regex(/^\d+(\.\d+)?$/, `${label} must be a number`)
    .optional();

export const paginationQueryFields = {
  page: z
    .string()
    .regex(/^[1-9]\d*$/, "Page must be a positive whole number")
    .optional(),
  limit: z
    .string()
    .regex(/^[1-9]\d*$/, "Limit must be a positive whole number")
    .optional(),
};

export const dateStringField = (label: string) =>
  z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    error: `${label} must be a valid date`,
  });
