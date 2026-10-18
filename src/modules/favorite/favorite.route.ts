import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateParams } from "../../middleware/validateRequest";
import { favoriteController } from "./favorite.controller";
import { favoriteValidation } from "./favorite.validation";

const router = Router();

router.use(auth(Role.CUSTOMER));

router.get("/", favoriteController.getFavorites);
router.post(
  "/:gearId",
  validateParams(favoriteValidation.gearParams),
  favoriteController.addFavorite,
);
router.delete(
  "/:gearId",
  validateParams(favoriteValidation.gearParams),
  favoriteController.removeFavorite,
);

export const favoriteRoutes = router;
