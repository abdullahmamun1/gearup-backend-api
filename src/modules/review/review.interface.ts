export interface ICreateReviewInput {
  rentalOrderId: string;
  gearItemId: string;
  rating: number;
  comment?: string;
}
