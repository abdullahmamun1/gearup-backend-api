import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import {
  aiGlobalLimiter,
  aiLimiter,
  writeLimiter,
} from "../../middleware/rateLimit";
import {
  validateParams,
  validateQuery,
  validateRequest,
} from "../../middleware/validateRequest";
import { inboxController } from "./inbox.controller";
import { inboxValidation } from "./inbox.validation";

/** Mounted at /api/admin. */
const router = Router();
router.use(auth(Role.ADMIN));

router.get(
  "/inbox",
  validateQuery(inboxValidation.inboxQuery),
  inboxController.getMessages,
);
router.get(
  "/inbox/:messageId",
  validateParams(inboxValidation.messageParams),
  inboxController.getMessage,
);
router.patch(
  "/inbox/:messageId",
  validateParams(inboxValidation.messageParams),
  validateRequest(inboxValidation.updateStatus),
  inboxController.setArchived,
);
router.post(
  "/inbox/:messageId/draft",
  validateParams(inboxValidation.messageParams),
  aiGlobalLimiter,
  aiLimiter,
  inboxController.draftReply,
);
router.post(
  "/inbox/:messageId/reply",
  validateParams(inboxValidation.messageParams),
  writeLimiter,
  validateRequest(inboxValidation.reply),
  inboxController.reply,
);

export const inboxRoutes = router;
