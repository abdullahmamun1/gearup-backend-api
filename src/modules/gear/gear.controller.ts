import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { sendResponse } from "../../utils/sendResponse";
import { catchAsync } from "../../utils/catchAsync";
import { categoryService } from "../category/category.service";
import { gearService } from "./gear.service";
import { IGearQueryParams } from "./gear.interface";

const getAllCategories = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const categories = await categoryService.getAllCategories();
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Categories retrieved successfully",
      data: categories,
    });
  },
);

const addGearItem = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body;
    const result = await gearService.addGearItem(req.user!.id, payload);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Gear item added successfully",
      data: result,
    });
  },
);
const getAllGearItems = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const query = req.query;
    const gearItems = await gearService.getAllGearItems(
      query as IGearQueryParams,
    );
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Gear items retrieved successfully",
      data: gearItems.data,
      meta: gearItems.meta,
    });
  },
);
const getGearItemById = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { gearId } = req.params;
    const gearItem = await gearService.getGearItemById(gearId as string);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Gear item retrieved successfully",
      data: gearItem,
    });
  },
);

export const gearController = {
  getAllCategories,
  getAllGearItems,
  getGearItemById,
  addGearItem,
};
