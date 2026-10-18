import { prisma } from "../../lib/prisma";
import { toDateKey } from "../../utils/dates";
import { rentalAvailability } from "../rental/rental.availability";

/**
 * Compact views of the catalogue for prompts. Small enough to send whole
 * (a few hundred items); past that, filter in Prisma before asking the AI.
 */
const CACHE_MS = 5 * 60 * 1000;

export type CatalogItem = {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  pricePerDay: number;
  rating: number | null;
  about: string;
};

type Catalog = {
  items: CatalogItem[];
  categories: { id: string; name: string }[];
};

const catalogCache = new Map<string, { at: number; value: Catalog }>();

/** Rentable gear (free on every day of the range, when one is given). */
const getCatalog = async (range: { from: Date; to: Date } | null) => {
  const key = range ? `${toDateKey(range.from)}:${toDateKey(range.to)}` : "any";
  const hit = catalogCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const [gear, categories, ratings] = await Promise.all([
    prisma.gearItem.findMany({
      where: { isAvailable: true, stock: { gt: 0 } },
      select: {
        id: true,
        name: true,
        brand: true,
        description: true,
        pricePerDay: true,
        stock: true,
        isAvailable: true,
        category: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.review.groupBy({
      by: ["gearItemId"],
      where: { isHidden: false },
      _avg: { rating: true },
    }),
  ]);

  let rentable = gear;
  if (range) {
    const free = await rentalAvailability.availableUnits(
      prisma,
      gear,
      range.from,
      range.to,
    );
    rentable = gear.filter((item) => (free.get(item.id) ?? 0) > 0);
  }

  const ratingById = new Map(
    ratings.map((row) => [row.gearItemId, row._avg.rating]),
  );
  const value: Catalog = {
    items: rentable.map((item) => ({
      id: item.id,
      name: item.name,
      brand: item.brand,
      category: item.category.name,
      pricePerDay: Number(item.pricePerDay),
      rating: ratingById.get(item.id)
        ? Math.round(ratingById.get(item.id)! * 10) / 10
        : null,
      about: (item.description ?? "").slice(0, 140),
    })),
    categories,
  };
  catalogCache.set(key, { at: Date.now(), value });
  // Date-specific entries pile up; keep the cache small.
  if (catalogCache.size > 50) {
    catalogCache.delete(catalogCache.keys().next().value!);
  }
  return value;
};

export type PriceStats = {
  count: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
};

let statsCache: { at: number; value: Map<string, PriceStats> } | null = null;

const percentile = (sorted: number[], p: number) => {
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (index - low);
};

/** Daily-price spread per category, for pricing suggestions. */
const getPriceStats = async () => {
  if (statsCache && Date.now() - statsCache.at < CACHE_MS) {
    return statsCache.value;
  }
  const rows = await prisma.gearItem.findMany({
    select: { categoryId: true, pricePerDay: true },
  });
  const byCategory = new Map<string, number[]>();
  for (const row of rows) {
    const list = byCategory.get(row.categoryId) ?? [];
    list.push(Number(row.pricePerDay));
    byCategory.set(row.categoryId, list);
  }
  const value = new Map<string, PriceStats>();
  for (const [categoryId, prices] of byCategory) {
    const sorted = prices.sort((a, b) => a - b);
    value.set(categoryId, {
      count: sorted.length,
      p10: percentile(sorted, 0.1),
      p25: percentile(sorted, 0.25),
      median: percentile(sorted, 0.5),
      p75: percentile(sorted, 0.75),
      p90: percentile(sorted, 0.9),
    });
  }
  statsCache = { at: Date.now(), value };
  return value;
};

export const aiCatalog = { getCatalog, getPriceStats };
