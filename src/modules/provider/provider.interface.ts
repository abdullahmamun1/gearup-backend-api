import { RentalStatus } from "../../../generated/prisma/enums";

export interface IGetQueryParams {
  page?: string;
  limit?: string;
}

export interface IGetProviderOrdersQueryParams extends IGetQueryParams {
  status?: RentalStatus;
}

export interface IUpdateOrderStatusPayload {
  status: RentalStatus;
  note?: string;
  condition?: "OK" | "DAMAGED";
  damageAmount?: number;
}
