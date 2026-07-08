import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { adminController } from "./admin.controller";
import { auth } from "../../middleware/auth";

const router = Router();

router.use(auth(Role.ADMIN));

router.get("/users", adminController.getAllUsers);
router.patch("/users/:userId", adminController.updateUserStatus);

router.get("/gear", adminController.getAllGear);
router.get("/rentals", adminController.getAllRentals);

router.post("/category", adminController.createCategory);
router.patch("/category/:categoryId", adminController.updateCategory);
router.delete("/category/:categoryId", adminController.deleteCategory);

export const adminRoutes = router;
