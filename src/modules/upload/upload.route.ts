import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimit";
import { validateRequest } from "../../middleware/validateRequest";
import { uploadController } from "./upload.controller";
import { uploadValidation } from "./upload.validation";

const router = Router();

router.post(
  "/signature",
  auth(Role.CUSTOMER, Role.PROVIDER, Role.ADMIN),
  writeLimiter,
  validateRequest(uploadValidation.signature),
  uploadController.createSignature,
);

export const uploadRoutes = router;
