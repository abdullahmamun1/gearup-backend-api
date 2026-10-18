import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { getValidatedQuery } from "../../middleware/validateRequest";
import { sendResponse } from "../../utils/sendResponse";
import { IExportType, IInsightsQuery, IReportRange } from "./report.interface";
import { reportInsights } from "./report.insights";
import { reportService } from "./report.service";

const getAnalytics = catchAsync(async (req: Request, res: Response) => {
  const result = await reportService.getAnalytics(
    getValidatedQuery<IReportRange>(req),
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Analytics ready",
    data: result,
  });
});

/** Streams the CSV itself (no JSON envelope). */
const exportCsv = catchAsync(async (req: Request, res: Response) => {
  try {
    await reportService.exportCsv(
      req.params.type as IExportType,
      getValidatedQuery<IReportRange>(req),
      res,
    );
  } catch (error) {
    // Mid-stream there's no envelope to send: cut the download short.
    if (res.headersSent) return void res.destroy(error as Error);
    throw error;
  }
});

const getInsights = catchAsync(async (req: Request, res: Response) => {
  const { locale, ...range } = getValidatedQuery<IInsightsQuery>(req);
  const result = await reportInsights.getInsights(range, locale);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Insights ready",
    data: result,
  });
});

export const reportController = { getAnalytics, getInsights, exportCsv };
