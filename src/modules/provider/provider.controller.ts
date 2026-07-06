import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";

const getProviderOrders = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const providerId = req.user!.id;
  },
);

export const providerController = {
  getProviderOrders,
};
