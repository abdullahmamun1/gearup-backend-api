import { Router } from "express";
import { validateParams } from "../../middleware/validateRequest";
import { providerProfileController } from "./providerProfile.controller";
import { providerProfileValidation } from "./providerProfile.validation";

/** Public. Separate from the role-guarded /api/provider dashboard routes. */
const router = Router();

router.get(
  "/:providerId",
  validateParams(providerProfileValidation.params),
  providerProfileController.getProviderProfile,
);

export const providerProfileRoutes = router;
