import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import {
  validateParams,
  validateQuery,
  validateRequest,
} from "../../middleware/validateRequest";
import { claimController } from "./claim.controller";
import { claimValidation } from "./claim.validation";

/** Mounted at /api/admin. */
const router = Router();
router.use(auth(Role.ADMIN));

router.get(
  "/claims",
  validateQuery(claimValidation.claimsQuery),
  claimController.getClaims,
);
router.patch(
  "/claims/:orderId",
  validateParams(claimValidation.orderParams),
  validateRequest(claimValidation.resolveClaim),
  claimController.resolveClaim,
);

export const claimRoutes = router;
