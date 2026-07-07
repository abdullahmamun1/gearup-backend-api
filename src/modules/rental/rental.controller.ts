import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { rentalService } from "./rental.service";

const createOrder = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body;
    const customerId = req.user!.id;
    const order = await rentalService.createRentalOrder(customerId, payload);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Rental order created successfully",
      data: order,
    });
  },
);

const getOrders = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const customerId = req.user!.id;
    const orders = await rentalService.getRentalOrders(customerId);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Rental orders retrieved successfully",
      data: orders,
    });
  },
);

export const rentalController = {
  createOrder,
  getOrders,
};
