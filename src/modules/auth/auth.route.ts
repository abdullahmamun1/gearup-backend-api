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
router.post(
  "/google",
  validateRequest(authValidation.googleLogin),
  authController.loginWithGoogle,
);
router.post("/refresh-token", authController.refreshToken);

router.get(
  "/me",
  auth(Role.CUSTOMER, Role.PROVIDER, Role.ADMIN),
  authController.getLoggedInUser,
);
router.patch(
  "/me",
  auth(Role.CUSTOMER, Role.PROVIDER, Role.ADMIN),
  validateRequest(authValidation.updateProfile),
  authController.updateProfile,
);

export const authRoutes = router;
