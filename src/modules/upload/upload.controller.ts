import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { uploadService } from "./upload.service";

const createSignature = catchAsync(async (req: Request, res: Response) => {
  const result = uploadService.createSignature(req.user!, req.body.purpose);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Upload signature created",
    data: result,
  });
});

export const uploadController = { createSignature };
