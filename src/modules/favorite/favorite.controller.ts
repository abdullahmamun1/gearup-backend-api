import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { favoriteService } from "./favorite.service";

const getFavorites = catchAsync(async (req: Request, res: Response) => {
  const result = await favoriteService.getFavorites(req.user!.id);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Saved gear retrieved",
    data: result,
  });
});

const addFavorite = catchAsync(async (req: Request, res: Response) => {
  const result = await favoriteService.addFavorite(
    req.user!.id,
    req.params.gearId as string,
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Saved",
    data: result,
  });
});

const removeFavorite = catchAsync(async (req: Request, res: Response) => {
  const result = await favoriteService.removeFavorite(
    req.user!.id,
    req.params.gearId as string,
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Removed from saved",
    data: result,
  });
});

export const favoriteController = { getFavorites, addFavorite, removeFavorite };
