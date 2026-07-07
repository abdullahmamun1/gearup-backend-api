import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { paymentService } from "./payment.service";
import { sendResponse } from "../../utils/sendResponse";
import { createError } from "../../utils/createError";

const createPayment = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const customerId = req.user?.id;
    const { orderId } = req.body;
    const result = await paymentService.createCheckoutSession(
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
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body;
    const signature = req.headers["stripe-signature"] as string;
    if (!signature) {
      throw createError(400, "Missing stripe-signature header");
    }

    const result = await paymentService.handleWebhookEvent(payload, signature);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "",
      data: result,
    });
  },
);

export const paymentController = {
  createPayment,
  confirmPayment,
};
