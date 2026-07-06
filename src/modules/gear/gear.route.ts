import { Router } from "express";
import { gearController } from "./gear.controller";

const router = Router();

router.get("/categories", gearController.getAllCategories);

export const gearRoutes = router;
