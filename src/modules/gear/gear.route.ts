import { Router } from "express";
import { gearController } from "./gear.controller";

const router = Router();

router.get("/gear", gearController.getAllGearItems);
router.get("/gear/:gearId", gearController.getGearItemById);
router.get("/categories", gearController.getAllCategories);

export const gearRoutes = router;
