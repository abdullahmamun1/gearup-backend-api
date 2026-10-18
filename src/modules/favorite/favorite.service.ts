import { prisma } from "../../lib/prisma";
import { createError } from "../../utils/createError";
import { gearService } from "../gear/gear.service";

/** The customer's saved gear, newest first: ids for hearts, items for the page. */
const getFavorites = async (userId: string) => {
  const rows = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { gearItemId: true },
  });
  const ids = rows.map((row) => row.gearItemId);
  return { ids, items: await gearService.getGearCards(ids) };
};

/** Idempotent: saving twice is fine. */
const addFavorite = async (userId: string, gearItemId: string) => {
  const gear = await prisma.gearItem.findUnique({
    where: { id: gearItemId },
    select: { id: true },
  });
  if (!gear) throw createError(404, "Gear item not found");

  await prisma.favorite.upsert({
    where: { userId_gearItemId: { userId, gearItemId } },
    update: {},
    create: { userId, gearItemId },
  });
  return { gearItemId, saved: true };
};

const removeFavorite = async (userId: string, gearItemId: string) => {
  await prisma.favorite.deleteMany({ where: { userId, gearItemId } });
  return { gearItemId, saved: false };
};

export const favoriteService = { getFavorites, addFavorite, removeFavorite };
