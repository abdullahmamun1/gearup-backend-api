import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import {
  aiGlobalLimiter,
  aiLimiter,
  aiSuggestLimiter,
} from "../../middleware/rateLimit";
import { validateRequest } from "../../middleware/validateRequest";
import { aiController } from "./ai.controller";
import { aiValidation } from "./ai.validation";

const router = Router();

router.post(
  "/gear-finder",
  aiGlobalLimiter,
  aiLimiter,
  validateRequest(aiValidation.gearFinder),
  aiController.gearFinder,
);

router.post(
  "/listing-draft",
  auth(Role.PROVIDER),
  aiGlobalLimiter,
  aiLimiter,
  validateRequest(aiValidation.listingDraft),
  aiController.listingDraft,
);

// Typing is bursty: its own, looser per-visitor limit (results are cached).
router.post(
  "/search-suggest",
  aiGlobalLimiter,
  aiSuggestLimiter,
  validateRequest(aiValidation.searchSuggest),
  aiController.searchSuggest,
);

export const aiRoutes = router;
