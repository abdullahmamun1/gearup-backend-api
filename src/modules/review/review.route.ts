import { Router } from "express";
import { reviewController } from "./review.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../generated/prisma/enums";

const router = Router();

router.post("/", auth(Role.CUSTOMER), reviewController.createReview);
router.get("/gear/:gearId/reviews", reviewController.getReviewsForGear);

export const reviewRoutes = router;
