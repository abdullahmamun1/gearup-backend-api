import { Router } from "express";
import { gearController } from "./gear.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../generated/prisma/client";
import {
  validateParams,
  validateQuery,
  validateRequest,
} from "../../middleware/validateRequest";
import { gearValidation } from "./gear.validation";

const router = Router();

router.get(
  "/gear",
  validateQuery(gearValidation.gearQuery),
  gearController.getAllGearItems,
);
router.get(
  "/gear/:gearId",
  validateParams(gearValidation.gearIdParam),
  gearController.getGearItemById,
);
router.get("/categories", gearController.getAllCategories);

router.get(
  "/provider/gear",
  auth(Role.PROVIDER),
  validateQuery(gearValidation.providerGearQuery),
  gearController.getProviderGearItems,
);

router.post(
  "/provider/gear",
  auth(Role.PROVIDER),
  validateRequest(gearValidation.addGearItem),
  gearController.addGearItem,
);

router.put(
  "/provider/gear/:gearId",
  auth(Role.PROVIDER),
  validateParams(gearValidation.gearIdParam),
  validateRequest(gearValidation.updateGearItem),
  gearController.updateGearItem,
);

router.delete(
  "/provider/gear/:gearId",
  auth(Role.PROVIDER),
  validateParams(gearValidation.gearIdParam),
  gearController.deleteGearItem,
);

export const gearRoutes = router;
