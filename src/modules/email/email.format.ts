import { Locale } from "../../../generated/prisma/enums";
import { IOrderEmail } from "./email.interface";

/**
 * Money, dates and counts for an email's language. Bangla uses Bengali
 * digits and month names (bn-BD), English keeps "BDT 1,250" and en-GB dates.
 */
export const emailFormat = (locale: Locale) => {
  const bn = locale === "bn";
  const tag = bn ? "bn-BD" : "en-GB";
  const money = new Intl.NumberFormat(bn ? "bn-BD" : "en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  });
  const number = new Intl.NumberFormat(tag);
  const day = new Intl.DateTimeFormat(tag, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const deadline = new Intl.DateTimeFormat(tag, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    // Bangla gets "৪:০০ বিকাল" rather than a Latin "PM".
    ...(bn ? { hourCycle: "h12", dayPeriod: "short" } : { hour12: true }),
    timeZone: "Asia/Dhaka",
  });

  return {
    money: (amount: number) => money.format(amount),
    number: (value: number) => number.format(value),
    /** "YYYY-MM-DD" booking day → "Tue, 20 Oct 2026". */
    day: (key: string) => day.format(new Date(`${key}T00:00:00.000Z`)),
    /** ISO instant → "20 Oct, 3:00 pm (Bangladesh time)". */
    deadline: (iso: string) =>
      `${deadline.format(new Date(iso))} (${bn ? "বাংলাদেশ সময়" : "Bangladesh time"})`,
    /** Rental length in days. */
    dayCount: (order: IOrderEmail) =>
      Math.round(
        (Date.parse(order.endDate) - Date.parse(order.startDate)) / 86_400_000,
      ),
    /** "2 × Tent, Kayak" (user content stays as written). */
    items: (order: IOrderEmail) =>
      order.items
        .map((item) =>
          item.quantity > 1
            ? `${number.format(item.quantity)} × ${item.name}`
            : item.name,
        )
        .join(", "),
    shortId: (order: IOrderEmail) => order.orderId.slice(0, 8),
    firstName: (name: string) => name.split(/\s+/)[0] || "",
  };
};

export type EmailFormat = ReturnType<typeof emailFormat>;
