import { Request, Response } from "express";
import httpStatus from "http-status";
import { getValidatedQuery } from "../../middleware/validateRequest";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { IGetClaimsQueryParams } from "./claim.interface";
import { claimService } from "./claim.service";

const getClaims = catchAsync(async (req: Request, res: Response) => {
  const result = await claimService.getClaims(
    getValidatedQuery<IGetClaimsQueryParams>(req),
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Damage claims retrieved successfully",
    data: result,
  });
});

const resolveClaim = catchAsync(async (req: Request, res: Response) => {
  const result = await claimService.resolveClaim(
    req.params.orderId as string,
    req.body,
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Damage claim settled",
    data: result,
  });
});

export const claimController = { getClaims, resolveClaim };
