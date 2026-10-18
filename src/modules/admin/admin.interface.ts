export interface IGetUsersQueryParams {
  page?: string;
  limit?: string;
  role?: string;
  status?: string;
}

export interface IGetAdminGearQueryParams {
  page?: string;
  limit?: string;
  searchTerm?: string;
  category?: string;
  isAvailable?: string;
}

export interface IGetAdminReviewsQueryParams {
  page?: string;
  limit?: string;
  visibility?: "visible" | "hidden";
  rating?: number;
  searchTerm?: string;
}

export interface IGetSubscribersQueryParams {
  page?: string;
  limit?: string;
  status?: "confirmed" | "pending" | "unsubscribed";
  searchTerm?: string;
}
