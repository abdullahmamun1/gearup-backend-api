import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { rentalService } from "./rental.service";
import { IGetOrderQueryParams } from "./rental.interface";
import { Role } from "../../../generated/prisma/enums";

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
    const query = req.query;
    const orders = await rentalService.getRentalOrders(
      customerId,
      query as IGetOrderQueryParams,
    );
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Rental orders retrieved successfully",
      data: orders,
    });
  },
);

const getOrderById = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const customerId = req.user!.id;
    const customerRole = req.user!.role;
    const { orderId } = req.params;
    const order = await rentalService.getRentalOrderById(
      orderId as string,
      customerId as string,
      customerRole as Role,
    );
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Rental order retrieved successfully",
      data: order,
    });
  },
);

const cancelOrder = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const customerId = req.user?.id;
    const { orderId } = req.params;
    const order = await rentalService.cancelRentalOrder(
      customerId as string,
      orderId as string,
    );
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Rental order cancelled successfully",
      data: order,
    });
  },
);

export const rentalController = {
  createOrder,
  getOrders,
  getOrderById,
  cancelOrder,
};
