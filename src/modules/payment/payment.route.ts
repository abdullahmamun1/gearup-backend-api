import { Router } from "express";
import { paymentController } from "./payment.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../generated/prisma/enums";

const router = Router();

router.post("/confirm", paymentController.confirmPayment);
router.post("/create", auth(Role.CUSTOMER), paymentController.createPayment);

router.get("/", auth(Role.CUSTOMER), paymentController.getMyPayments);
router.get(
  "/:paymentId",
  auth(Role.CUSTOMER),
  paymentController.getPaymentsbyId,
);

export const paymentRoutes = router;
