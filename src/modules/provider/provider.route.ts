import { Router } from "express";
import { providerController } from "./provider.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../generated/prisma/client";

const router = Router();

router.use(auth(Role.PROVIDER));

router.get("/orders", providerController.getProviderOrders);
router.patch("/orders/:orderId", providerController.updateOrderStatus);

export const providerRoutes = router;
