import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import {
  validateParams,
  validateQuery,
} from "../../middleware/validateRequest";
import { aiGlobalLimiter, aiLimiter } from "../../middleware/rateLimit";
import { reportController } from "./report.controller";
import { reportValidation } from "./report.validation";

/** Mounted at /api/admin. */
const router = Router();
router.use(auth(Role.ADMIN));

router.get(
  "/analytics",
  validateQuery(reportValidation.range),
  reportController.getAnalytics,
);
router.get(
  "/analytics/insights",
  aiGlobalLimiter,
  aiLimiter,
  validateQuery(reportValidation.insightsQuery),
  reportController.getInsights,
);
router.get(
  "/export/:type",
  validateParams(reportValidation.exportParams),
  validateQuery(reportValidation.range),
  reportController.exportCsv,
);

export const reportRoutes = router;
