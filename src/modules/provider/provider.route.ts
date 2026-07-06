import { Router } from "express";
import { providerController } from "./provider.controller";

const router = Router();

router.get("/orders", providerController.getProviderOrders);

export const providerRoutes = router;
