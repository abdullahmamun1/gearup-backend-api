import { Router } from "express";
import { cronController } from "./cron.controller";

const router = Router();

/** Called by Vercel Cron (see vercel.json) with `Authorization: Bearer <CRON_SECRET>`. */
router.get("/daily", cronController.runDaily);

export const cronRoutes = router;
