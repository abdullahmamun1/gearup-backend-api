import { timingSafeEqual } from "node:crypto";
import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config";
import { catchAsync } from "../../utils/catchAsync";
import { createError } from "../../utils/createError";
import { sendResponse } from "../../utils/sendResponse";
import { cronService } from "./cron.service";

const isAuthorized = (header: string | undefined) => {
  if (!config.cron_secret || !header) return false;
  const expected = Buffer.from(`Bearer ${config.cron_secret}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const runDaily = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!config.cron_secret) {
      throw createError(503, "CRON_SECRET is not configured");
    }
    if (!isAuthorized(req.headers.authorization)) {
      throw createError(401, "Unauthorized");
    }

    const result = await cronService.runDaily();
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Daily job finished",
      data: result,
    });
  },
);

export const cronController = { runDaily };
