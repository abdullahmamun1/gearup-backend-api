export interface IGetClaimsQueryParams {
  page?: string;
  limit?: string;
  /** "open" (awaiting a decision, the default) or "resolved". */
  status?: "open" | "resolved";
}

export interface IResolveClaimPayload {
  /** How much of the deposit to keep, from 0 to the whole deposit. */
  keepAmount: number;
  note?: string;
}
