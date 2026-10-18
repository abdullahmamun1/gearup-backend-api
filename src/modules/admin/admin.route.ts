import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { adminController } from "./admin.controller";
import { auth } from "../../middleware/auth";
import {
  validateParams,
  validateQuery,
  validateRequest,
} from "../../middleware/validateRequest";
import { adminValidation } from "./admin.validation";

const router = Router();

router.use(auth(Role.ADMIN));

router.get(
  "/users",
  validateQuery(adminValidation.usersQuery),
  adminController.getAllUsers,
);
router.patch(
  "/users/:userId",
  validateRequest(adminValidation.updateUserStatus),
  adminController.updateUserStatus,
);

router.get(
  "/gear",
  validateQuery(adminValidation.gearQuery),
  adminController.getAllGear,
);
router.patch(
  "/gear/:gearId",
  validateParams(adminValidation.gearParams),
  validateRequest(adminValidation.featureGear),
  adminController.setGearFeatured,
);
router.get(
  "/rentals",
  validateQuery(adminValidation.rentalsQuery),
  adminController.getAllRentals,
);

router.post(
  "/category",
  validateRequest(adminValidation.createCategory),
  adminController.createCategory,
);
router.patch(
  "/category/:categoryId",
  validateRequest(adminValidation.updateCategory),
  adminController.updateCategory,
);
router.delete("/category/:categoryId", adminController.deleteCategory);

router.get(
  "/reviews",
  validateQuery(adminValidation.reviewsQuery),
  adminController.getAllReviews,
);
router.patch(
  "/reviews/:reviewId",
  validateParams(adminValidation.reviewParams),
  validateRequest(adminValidation.moderateReview),
  adminController.moderateReview,
);

router.get(
  "/subscribers",
  validateQuery(adminValidation.subscribersQuery),
  adminController.getSubscribers,
);

export const adminRoutes = router;
