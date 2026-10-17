import { Router } from "express";
import { authController } from "./auth.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../generated/prisma/enums";
import {
  authLimiter,
  oauthLimiter,
  writeLimiter,
} from "../../middleware/rateLimit";
import { validateRequest } from "../../middleware/validateRequest";
import { authValidation } from "./auth.validation";

const router = Router();

router.post(
  "/register",
  authLimiter,
  validateRequest(authValidation.registerUser),
  authController.registerUser,
);
router.post(
  "/login",
  authLimiter,
  validateRequest(authValidation.loginUser),
  authController.loginUser,
);
router.post(
  "/google",
  oauthLimiter,
  validateRequest(authValidation.googleLogin),
  authController.loginWithGoogle,
);
router.post("/refresh-token", authController.refreshToken);

router.post(
  "/verify-email",
  validateRequest(authValidation.verifyEmail),
  authController.verifyEmail,
);
router.post(
  "/resend-verification",
  auth(Role.CUSTOMER, Role.PROVIDER, Role.ADMIN),
  writeLimiter,
  authController.resendVerification,
);
router.post(
  "/forgot-password",
  authLimiter,
  validateRequest(authValidation.forgotPassword),
  authController.forgotPassword,
);
router.post(
  "/reset-password",
  validateRequest(authValidation.resetPassword),
  authController.resetPassword,
);

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
