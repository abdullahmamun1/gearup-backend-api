import { RentalStatus } from "../../../generated/prisma/enums";

export interface OrderItemInput {
  gearItemId: string;
  quantity: number;
}

export interface ICreateRentalOrderInput {
  items: OrderItemInput[];
  startDate: string;
  endDate: string;
}

export interface IGetOrderQueryParams {
  page?: string;
  limit?: string;
  status?: RentalStatus;
}
