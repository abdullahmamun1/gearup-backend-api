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

const loginWithGoogle = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { accessToken, refreshToken } = await authService.loginWithGoogle(
      req.body,
    );

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

const updateProfile = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const user = await authService.updateProfile(userId as string, req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Profile updated successfully",
      data: user,
    });
  },
);

const verifyEmail = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    await authService.verifyEmail(req.body.token);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Your email is verified",
      data: null,
    });
  },
);

const resendVerification = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    await authService.resendVerification(req.user!.id);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Verification email sent",
      data: null,
    });
  },
);

const forgotPassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    await authService.forgotPassword(req.body.email);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message:
        "If an account exists for that email, we've sent a link to reset the password.",
      data: null,
    });
  },
);

const resetPassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    await authService.resetPassword(req.body.token, req.body.password);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Your password has been reset. Please sign in.",
      data: null,
    });
  },
);

export const authController = {
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  registerUser,
  loginUser,
  loginWithGoogle,
  refreshToken,
  getLoggedInUser,
  updateProfile,
};
