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
}

export interface IAddGearItemPayload {
  name: string;
  description?: string;
  brand?: string;
  imageUrl?: string;
  pricePerDay: number;
  stock: number;
  categoryId: string;
}

export interface IUpdateGearItemPayload {
  name?: string;
  description?: string;
  brand?: string;
  imageUrl?: string;
  pricePerDay?: number;
  stock?: number;
  isAvailable?: boolean;
  categoryId?: string;
}
