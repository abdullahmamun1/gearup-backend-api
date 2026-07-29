import { Router } from "express";
import { paymentController } from "./payment.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../generated/prisma/enums";
import {
  validateQuery,
  validateRequest,
} from "../../middleware/validateRequest";
import { paymentValidation } from "./payment.validation";

const router = Router();

router.post("/confirm", paymentController.confirmPayment);
router.post(
  "/create",
  auth(Role.CUSTOMER),
  validateRequest(paymentValidation.createPayment),
  paymentController.createPayment,
);

router.get(
  "/",
  auth(Role.CUSTOMER),
  validateQuery(paymentValidation.paymentQuery),
  paymentController.getMyPayments,
);
router.get(
  "/:paymentId",
  auth(Role.CUSTOMER),
  paymentController.getPaymentsbyId,
);

export const paymentRoutes = router;
