import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { authService } from "./auth.service";
import { sendResponse } from "../../utils/sendResponse";
import { createError } from "../../utils/createError";

const registerUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body;
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

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "User is logged in succesfully",
      data: { accessToken, refreshToken },
    });
  },
);

const refreshToken = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.refreshToken
      ? req.cookies.refreshToken
      : req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization?.split(" ")[1]
        : req.headers.authorization;

    if (!token) {
      throw createError(401, "No refresh token provided");
    }

    const { accessToken } = await authService.refreshToken(token);

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24,
    });

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Access token is retrieved succesfully",
      data: { accessToken },
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
  refreshToken,
  getLoggedInUser,
};
