import { Router } from "express";
import { reviewController } from "./review.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../generated/prisma/enums";
import {
  validateQuery,
  validateRequest,
} from "../../middleware/validateRequest";
import { reviewValidation } from "./review.validation";

const router = Router();

router.post(
  "/reviews",
  auth(Role.CUSTOMER),
  validateRequest(reviewValidation.createReview),
  reviewController.createReview,
);
router.get(
  "/gear/:gearId/reviews",
  validateQuery(reviewValidation.reviewQuery),
  reviewController.getReviewsForGear,
);

export const reviewRoutes = router;
