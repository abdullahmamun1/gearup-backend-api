import { Router } from "express";
import { writeLimiter } from "../../middleware/rateLimit";
import { validateRequest } from "../../middleware/validateRequest";
import { contactController } from "./contact.controller";
import { contactValidation } from "./contact.validation";

const router = Router();

router.post(
  "/",
  writeLimiter,
  validateRequest(contactValidation.createMessage),
  contactController.createMessage,
);

export const contactRoutes = router;
