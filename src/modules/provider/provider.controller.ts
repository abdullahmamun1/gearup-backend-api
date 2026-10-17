import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { providerService } from "./provider.service";
import { sendResponse } from "../../utils/sendResponse";
import { getValidatedQuery } from "../../middleware/validateRequest";
import { IGetQueryParams } from "./provider.interface";

const getProviderOrders = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const providerId = req.user!.id;
    const query = getValidatedQuery<IGetQueryParams>(req);
    const orders = await providerService.getProviderOrders(
      providerId,
      query,
    );
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Provider orders retrieved successfully",
      data: orders,
    });
  },
);

const updateOrderStatus = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { status } = req.body;
    const { orderId } = req.params;
    const providerId = req.user!.id;

    const updatedOrder = await providerService.updateOrderStatus(
      providerId,
      orderId as string,
      status,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Order status updated successfully",
      data: updatedOrder,
    });
  },
);

export const providerController = {
  getProviderOrders,
  updateOrderStatus,
};
