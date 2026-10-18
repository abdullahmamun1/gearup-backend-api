import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimit";
import {
  validateParams,
  validateRequest,
} from "../../middleware/validateRequest";
import { messageController } from "./message.controller";
import { messageValidation } from "./message.validation";

/** Mounted at /api: order threads live under /rentals/:orderId/messages. */
const router = Router();
const participant = auth(Role.CUSTOMER, Role.PROVIDER);

router.get("/messages/unread", participant, messageController.getUnread);

router.get(
  "/rentals/:orderId/messages",
  participant,
  validateParams(messageValidation.orderParams),
  messageController.getMessages,
);
router.post(
  "/rentals/:orderId/messages",
  participant,
  writeLimiter,
  validateParams(messageValidation.orderParams),
  validateRequest(messageValidation.sendMessage),
  messageController.sendMessage,
);
router.patch(
  "/rentals/:orderId/messages/read",
  participant,
  validateParams(messageValidation.orderParams),
  messageController.markRead,
);

export const messageRoutes = router;
