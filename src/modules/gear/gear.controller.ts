import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { sendResponse } from "../../utils/sendResponse";
import { catchAsync } from "../../utils/catchAsync";
import { categoryService } from "../category/category.service";
import { gearService } from "./gear.service";
import { IGearQueryParams, IProviderGearQueryParams } from "./gear.interface";

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

const getAllBrands = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const brands = await gearService.getAllBrands();
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Brands retrieved successfully",
      data: brands,
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
      data: gearItems,
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

const getProviderGearItems = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const providerId = req.user!.id;
    const result = await gearService.getProviderGearItems(
      providerId,
      req.query as IProviderGearQueryParams,
    );
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Your gear items retrieved successfully",
      data: result,
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

const updateGearItem = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body;
    const { gearId } = req.params;
    const providerId = req.user!.id;
    const result = await gearService.updateGearItem(
      providerId,
      gearId as string,
      payload,
    );
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Gear item updated successfully",
      data: result,
    });
  },
);

const deleteGearItem = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { gearId } = req.params;
    const providerId = req.user!.id;
    await gearService.deleteGearItem(providerId, gearId as string);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Gear item deleted successfully",
      data: null,
    });
  },
);

export const gearController = {
  getAllCategories,
  getAllBrands,
  getAllGearItems,
  getGearItemById,
  getProviderGearItems,
  addGearItem,
  updateGearItem,
  deleteGearItem,
};
