import { Router } from "express";
import { auth } from "../../middleware/auth";
import { Role } from "../../../generated/prisma/client";
import { rentalController } from "./rental.controller";
import {
  validateQuery,
  validateRequest,
} from "../../middleware/validateRequest";
import { rentalValidation } from "./rental.validation";

const router = Router();

router.post(
  "/",
  auth(Role.CUSTOMER),
  validateRequest(rentalValidation.createOrder),
  rentalController.createOrder,
);

router.get(
  "/",
  auth(Role.CUSTOMER),
  validateQuery(rentalValidation.orderQuery),
  rentalController.getOrders,
);
router.get(
  "/:orderId",
  auth(Role.CUSTOMER, Role.ADMIN, Role.PROVIDER),
  rentalController.getOrderById,
);

router.patch(
  "/:orderId/cancel",
  auth(Role.CUSTOMER),
  rentalController.cancelOrder,
);

export const rentalRoutes = router;
