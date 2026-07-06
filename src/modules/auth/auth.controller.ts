import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { authService } from "./auth.service";
import { sendResponse } from "../../utils/sendResponse";
import { Role } from "../../../generated/prisma/enums";
import { createError } from "../../utils/createError";

const registerUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body;
    const allowedRoles = [Role.CUSTOMER, Role.PROVIDER];
    if (!allowedRoles.includes(payload.role)) {
      throw createError(400, "Invalid Role!!");
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
const loginUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body;

    const { accessToken, refreshToken } = await authService.loginUser(payload);

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24,
    });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "User is logged in succesfully",
      data: { accessToken, refreshToken },
    });
  },
);
const getLoggedInUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const user = await authService.getLoggedInUser(userId as string);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "User data retrieved successfully",
      data: user,
    });
  },
);

export const authController = {
  registerUser,
  loginUser,
  getLoggedInUser,
};
