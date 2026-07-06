import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { adminController } from "./admin.controller";
import { auth } from "../../middleware/auth";

const router = Router();

router.post("/category", auth(Role.ADMIN), adminController.createCategory);
router.patch(
  "/category/:categoryId",
  auth(Role.ADMIN),
  adminController.updateCategory,
);
router.delete(
  "/category/:categoryId",
  auth(Role.ADMIN),
  adminController.deleteCategory,
);

export const adminRoutes = router;
