import { z } from "zod";

export const uuidField = (label: string) =>
  z.uuid(`${label} must be a valid ID`);

export const numericQueryField = (label: string) =>
  z
    .string()
    .regex(/^\d+(\.\d+)?$/, `${label} must be a number`)
    .optional();

export const MAX_PAGE_SIZE = 100;

export const paginationQueryFields = {
  page: z
    .string()
    .regex(/^[1-9]\d*$/, "Page must be a positive whole number")
    .optional(),
  limit: z
    .string()
    .regex(/^[1-9]\d*$/, "Limit must be a positive whole number")
    .refine(
      (value) => Number(value) <= MAX_PAGE_SIZE,
      `Limit must be at most ${MAX_PAGE_SIZE}`,
    )
    .optional(),
};

/**
 * A calendar date. Accepts `YYYY-MM-DD` or a full ISO timestamp and keeps
 * only the date part, so `2026-08-01T00:00:00.000Z` becomes `2026-08-01`.
 */
export const dateKeyField = (label: string) =>
  z
    .string(`${label} is required`)
    .regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, `${label} must be a date (YYYY-MM-DD)`)
    .transform((value) => value.slice(0, 10))
    .refine(
      (value) => {
        const date = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
      },
      { error: `${label} must be a real calendar date` },
    );
