import { Router } from "express";
import { providerController } from "./provider.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../generated/prisma/client";
import {
  validateQuery,
  validateRequest,
} from "../../middleware/validateRequest";
import { providerValidation } from "./provider.validation";

const router = Router();

router.use(auth(Role.PROVIDER));

router.get(
  "/orders",
  validateQuery(providerValidation.orderQuery),
  providerController.getProviderOrders,
);
router.patch(
  "/orders/:orderId",
  validateRequest(providerValidation.updateOrderStatus),
  providerController.updateOrderStatus,
);

export const providerRoutes = router;
