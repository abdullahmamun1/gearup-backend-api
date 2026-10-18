export interface IGearQueryParams {
  searchTerm?: string;
  category?: string;
  brand?: string;
  minPrice?: string;
  maxPrice?: string;
  isAvailable?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  from?: string;
  to?: string;
  city?: string;
  /** "lat,lng" */
  near?: string;
  /** Kilometres around `near`; defaults to 25. */
  radius?: number;
}

export interface IProviderGearQueryParams {
  searchTerm?: string;
  category?: string;
  isAvailable?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface IAddGearItemPayload {
  name: string;
  description?: string;
  brand?: string;
  imageUrl?: string;
  images?: string[];
  pricePerDay: number;
  depositAmount?: number;
  stock: number;
  categoryId: string;
}

export type IUpdateGearItemPayload = Partial<IAddGearItemPayload> & {
  isAvailable?: boolean;
};

export interface IAvailabilityQueryParams {
  from?: string;
  to?: string;
}
