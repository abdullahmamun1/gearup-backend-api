import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { aiService } from "./ai.service";
import { aiSuggest } from "./ai.suggest";

const gearFinder = catchAsync(async (req: Request, res: Response) => {
  const result = await aiService.gearFinder(req.body);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Suggestions ready",
    data: result,
  });
});

const listingDraft = catchAsync(async (req: Request, res: Response) => {
  const result = await aiService.listingDraft(req.body);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Draft ready — review it before saving",
    data: result,
  });
});

const searchSuggest = catchAsync(async (req: Request, res: Response) => {
  const result = await aiSuggest.searchSuggest(req.body.q, req.body.locale);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Suggestions ready",
    data: result,
  });
});

export const aiController = {
  searchSuggest, gearFinder, listingDraft };
