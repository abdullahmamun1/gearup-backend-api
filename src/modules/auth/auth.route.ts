import { Router } from "express";
import { authController } from "./auth.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../generated/prisma/enums";
import { validateRequest } from "../../middleware/validateRequest";
import { authValidation } from "./auth.validation";

const router = Router();

router.post(
  "/register",
  validateRequest(authValidation.registerUser),
  authController.registerUser,
);
router.post(
  "/login",
  validateRequest(authValidation.loginUser),
  authController.loginUser,
);
router.post("/refresh-token", authController.refreshToken);

router.get(
  "/me",
  auth(Role.CUSTOMER, Role.PROVIDER, Role.ADMIN),
  authController.getLoggedInUser,
);

export const authRoutes = router;
