import { Router } from "express";
import { paymentController } from "./payment.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../generated/prisma/enums";

const router = Router();

router.post("/confirm", paymentController.confirmPayment);
router.post("/create", auth(Role.CUSTOMER), paymentController.createPayment);

export const paymentRoutes = router;
