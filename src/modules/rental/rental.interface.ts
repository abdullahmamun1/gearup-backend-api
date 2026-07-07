export interface OrderItemInput {
  gearItemId: string;
  quantity: number;
}

export interface ICreateRentalOrderInput {
  items: OrderItemInput[];
  startDate: string;
  endDate: string;
}
