import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { newsletterService } from "./newsletter.service";

const subscribe = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await newsletterService.subscribe(req.body.email, req.body.locale);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message:
        result.status === "subscribed"
          ? "You're already subscribed."
          : "Almost there — check your inbox to confirm.",
      data: result,
    });
  },
);

const confirm = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await newsletterService.confirm(req.body.token);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "You're subscribed to GearUp news.",
      data: result,
    });
  },
);

const unsubscribe = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await newsletterService.unsubscribe(req.body.token);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "You've been unsubscribed.",
      data: result,
    });
  },
);

export const newsletterController = { subscribe, confirm, unsubscribe };
