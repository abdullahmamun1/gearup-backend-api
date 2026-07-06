import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { IProviderOrderQueryParams } from "./provider.interface";
import { providerService } from "./provider.service";
import { sendResponse } from "../../utils/sendResponse";

const getProviderOrders = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const providerId = req.user!.id;
    const query = req.query;
    const orders = await providerService.getProviderOrders(
      providerId,
      query as IProviderOrderQueryParams,
    );
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Provider orders retrieved successfully",
      data: orders.data,
      meta: orders.meta,
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
