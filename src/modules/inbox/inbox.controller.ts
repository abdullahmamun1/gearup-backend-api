import { Request, Response } from "express";
import httpStatus from "http-status";
import { getValidatedQuery } from "../../middleware/validateRequest";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { IGetInboxQueryParams } from "./inbox.interface";
import { inboxService } from "./inbox.service";

const getMessages = catchAsync(async (req: Request, res: Response) => {
  const result = await inboxService.getMessages(
    getValidatedQuery<IGetInboxQueryParams>(req),
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Messages retrieved successfully",
    data: result,
  });
});

const getMessage = catchAsync(async (req: Request, res: Response) => {
  const result = await inboxService.getMessage(req.params.messageId as string);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Message retrieved successfully",
    data: result,
  });
});

const setArchived = catchAsync(async (req: Request, res: Response) => {
  const result = await inboxService.setArchived(
    req.params.messageId as string,
    req.body.archived,
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: req.body.archived ? "Message archived" : "Message moved to inbox",
    data: result,
  });
});

const draftReply = catchAsync(async (req: Request, res: Response) => {
  const result = await inboxService.draftReply(
    req.params.messageId as string,
    req.user?.name ?? "The GearUp team",
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Draft ready",
    data: result,
  });
});

const reply = catchAsync(async (req: Request, res: Response) => {
  const result = await inboxService.reply(
    req.params.messageId as string,
    req.body,
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Reply sent",
    data: result,
  });
});

export const inboxController = {
  getMessages,
  getMessage,
  setArchived,
  draftReply,
  reply,
};
