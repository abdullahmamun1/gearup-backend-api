import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { adminController } from "./admin.controller";
import { auth } from "../../middleware/auth";
import {
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

export const adminRoutes = router;
