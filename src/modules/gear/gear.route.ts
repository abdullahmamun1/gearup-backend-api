import { Router } from "express";
import { gearController } from "./gear.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../generated/prisma/client";

const router = Router();

router.get("/gear", gearController.getAllGearItems);
router.get("/gear/:gearId", gearController.getGearItemById);
router.get("/categories", gearController.getAllCategories);

router.post("/provider/gear", auth(Role.PROVIDER), gearController.addGearItem);

router.put(
  "/provider/gear/:gearId",
  auth(Role.PROVIDER),
  gearController.updateGearItem,
);

router.delete(
  "/provider/gear/:gearId",
  auth(Role.PROVIDER),
  gearController.deleteGearItem,
);

export const gearRoutes = router;
