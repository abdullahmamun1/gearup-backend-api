import { Router } from "express";
import { auth } from "../../middleware/auth";
import { Role } from "../../../generated/prisma/client";
import { rentalController } from "./rental.controller";

const router = Router();

router.post("/", auth(Role.CUSTOMER), rentalController.createOrder);
router.get("/", auth(Role.CUSTOMER), rentalController.getOrders);
router.get("/:orderId", auth(Role.CUSTOMER), rentalController.getOrderById);
router.patch(
  "/:orderId/cancel",
  auth(Role.CUSTOMER),
  rentalController.cancelOrder,
);
export const rentalRoutes = router;
