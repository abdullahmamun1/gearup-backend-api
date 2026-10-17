import { Request, Response } from "express";
import httpStatus from "http-status";
import { sendResponse } from "../utils/sendResponse";

export const notFound = (req: Request, res: Response) => {
  sendResponse(res, {
    success: false,
    statusCode: httpStatus.NOT_FOUND,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    data: null,
  });
};
