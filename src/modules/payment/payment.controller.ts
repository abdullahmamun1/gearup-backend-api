import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { paymentService } from "./payment.service";
import { sendResponse } from "../../utils/sendResponse";

const createPayment = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const customerId = req.user?.id;
    const { orderId } = req.body;
    const result = await paymentService.createPaymentIntent(
      orderId as string,
      customerId as string,
    );
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Payment intent created successfully",
      data: result,
    });
  },
);
const confirmPayment = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {},
);

export const paymentController = {
  createPayment,
  confirmPayment,
};
