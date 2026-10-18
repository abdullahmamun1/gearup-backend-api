import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { providerProfileService } from "./providerProfile.service";

const getProviderProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await providerProfileService.getProviderProfile(
    req.params.providerId as string,
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Provider retrieved",
    data: result,
  });
});

export const providerProfileController = { getProviderProfile };
