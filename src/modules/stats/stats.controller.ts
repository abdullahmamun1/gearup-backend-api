import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { statsService } from "./stats.service";

const getCustomerStats = catchAsync(async (req: Request, res: Response) => {
  const result = await statsService.getCustomerStats(req.user!.id);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Rental stats retrieved successfully",
    data: result,
  });
});

const getProviderStats = catchAsync(async (req: Request, res: Response) => {
  const result = await statsService.getProviderStats(req.user!.id);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Provider stats retrieved successfully",
    data: result,
  });
});

export const statsController = { getCustomerStats, getProviderStats };
