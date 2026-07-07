import { Router } from "express";
import { providerController } from "./provider.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../generated/prisma/client";

const router = Router();

router.get(
  "/orders",
  auth(Role.PROVIDER),
  providerController.getProviderOrders,
);

router.patch(
  "/orders/:orderId",
  auth(Role.PROVIDER),
  providerController.updateOrderStatus,
);

export const providerRoutes = router;
