import { Locale } from "../../../generated/prisma/enums";

export interface IChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface IGearFinderPayload {
  messages: IChatMessage[];
  /** Trip dates (YYYY-MM-DD): only gear free on every day is suggested. */
  from?: string;
  to?: string;
  locale?: Locale;
}

export interface IListingDraftPayload {
  name: string;
  brand?: string;
  categoryId?: string;
  notes?: string;
  /** A Cloudinary photo of the item; other hosts are ignored. */
  imageUrl?: string;
  /** Language of the description (the provider's interface language). */
  locale?: Locale;
}

export interface IReviewSummary {
  summary: string;
  pros: string[];
  cons: string[];
}
