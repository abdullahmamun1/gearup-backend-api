export interface IGetInboxQueryParams {
  page?: string;
  limit?: string;
  status?: "NEW" | "REPLIED" | "ARCHIVED";
  searchTerm?: string;
}

export interface IReplyPayload {
  body: string;
}
