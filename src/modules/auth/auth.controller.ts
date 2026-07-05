import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";

const registerUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {},
);

export const authController = {
  registerUser,
};
