import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { messageService } from "./message.service";

const getMessages = catchAsync(async (req: Request, res: Response) => {
  const result = await messageService.getMessages(
    req.params.orderId as string,
    req.user!.id,
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Messages retrieved",
    data: result,
  });
});

const sendMessage = catchAsync(async (req: Request, res: Response) => {
  const result = await messageService.sendMessage(
    req.params.orderId as string,
    req.user!.id,
    req.body.body,
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Message sent",
    data: result,
  });
});

const markRead = catchAsync(async (req: Request, res: Response) => {
  const result = await messageService.markRead(
    req.params.orderId as string,
    req.user!.id,
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Marked as read",
    data: result,
  });
});

const getUnread = catchAsync(async (req: Request, res: Response) => {
  const result = await messageService.getUnread(req.user!.id);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Unread messages",
    data: result,
  });
});

export const messageController = { getMessages, sendMessage, markRead, getUnread };
