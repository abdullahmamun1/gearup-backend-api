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
