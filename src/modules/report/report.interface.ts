export interface IReportRange {
  /** "YYYY-MM-DD", inclusive. */
  from?: string;
  /** "YYYY-MM-DD", inclusive. */
  to?: string;
}

export interface IInsightsQuery extends IReportRange {
  locale?: "en" | "bn";
}

export type IExportType = "users" | "rentals" | "payments" | "subscribers";
