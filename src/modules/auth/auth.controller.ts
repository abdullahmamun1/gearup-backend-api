import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { authService } from "./auth.service";
import { sendResponse } from "../../utils/sendResponse";
import { Role } from "../../../generated/prisma/enums";

const registerUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body;
    const allowedRoles = [Role.CUSTOMER, Role.PROVIDER];
    if (!allowedRoles.includes(payload.role)) {
      throw new Error("Invalid Role!!");
    }
    const result = await authService.registerUser(payload);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "User is registered succesfully",
      data: result,
    });
  },
);

export const authController = {
  registerUser,
};
