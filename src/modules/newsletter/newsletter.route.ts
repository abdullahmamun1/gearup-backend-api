import { Router } from "express";
import { writeLimiter } from "../../middleware/rateLimit";
import { validateRequest } from "../../middleware/validateRequest";
import { newsletterController } from "./newsletter.controller";
import { newsletterValidation } from "./newsletter.validation";

const router = Router();

router.post(
  "/",
  writeLimiter,
  validateRequest(newsletterValidation.subscribe),
  newsletterController.subscribe,
);
router.post(
  "/confirm",
  validateRequest(newsletterValidation.token),
  newsletterController.confirm,
);
router.post(
  "/unsubscribe",
  validateRequest(newsletterValidation.token),
  newsletterController.unsubscribe,
);

export const newsletterRoutes = router;
