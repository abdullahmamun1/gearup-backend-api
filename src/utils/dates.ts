/**
 * Booking days are calendar dates in Bangladesh. They are stored as UTC
 * midnight of that date (`2026-10-20` → `2026-10-20T00:00:00.000Z`), which is
 * what `new Date("2026-10-20")` already produced before this helper existed.
 */

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** Bangladesh is UTC+6 all year (no daylight saving). */
const DHAKA_OFFSET_MS = 6 * HOUR_MS;

/** `"YYYY-MM-DD"` → the stored Date (UTC midnight). */
export const parseDateKey = (key: string) => new Date(`${key}T00:00:00.000Z`);

/** Stored Date → `"YYYY-MM-DD"`. */
export const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

/** Today's date in Dhaka, as a stored Date. */
export const today = (now = new Date()) =>
  parseDateKey(toDateKey(new Date(now.getTime() + DHAKA_OFFSET_MS)));

export const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * DAY_MS);

/** Whole days between two stored dates. */
export const daysBetween = (from: Date, to: Date) =>
  Math.round((to.getTime() - from.getTime()) / DAY_MS);

/** The instant a booking day begins in Dhaka (00:00 local). */
export const dayStartsAt = (day: Date) =>
  new Date(day.getTime() - DHAKA_OFFSET_MS);

export const minDate = (...dates: Date[]) =>
  new Date(Math.min(...dates.map((date) => date.getTime())));
