import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { contactService } from "./contact.service";

const createMessage = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await contactService.createMessage(req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Thanks — your message is with us. We'll reply by email.",
      data: result,
    });
  },
);

export const contactController = { createMessage };
