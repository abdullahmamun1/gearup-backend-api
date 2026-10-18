import { RentalStatus, Role, UserStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { createError } from "../../utils/createError";
import { approximate } from "../../utils/geo";
import { gearService } from "../gear/gear.service";

const HOUR_MS = 60 * 60 * 1000;

const median = (values: number[]) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

/**
 * A provider's public page: who they are, roughly where, how they do and
 * what they rent. No email, phone or exact address.
 */
const getProviderProfile = async (providerId: string) => {
  const provider = await prisma.user.findFirst({
    where: { id: providerId, role: Role.PROVIDER, status: UserStatus.ACTIVE },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      bio: true,
      city: true,
      area: true,
      latitude: true,
      longitude: true,
      createdAt: true,
    },
  });
  if (!provider) throw createError(404, "Provider not found");

  const [gear, completed, confirmed, ratings, reviews] = await Promise.all([
    prisma.gearItem.findMany({
      where: { providerId },
      orderBy: [{ isAvailable: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    }),
    prisma.rentalOrder.count({
      where: { providerId, status: RentalStatus.RETURNED },
    }),
    prisma.rentalOrder.findMany({
      where: { providerId, confirmedAt: { not: null } },
      orderBy: { confirmedAt: "desc" },
      take: 50,
      select: { createdAt: true, confirmedAt: true },
    }),
    prisma.review.aggregate({
      where: { gearItem: { providerId }, isHidden: false },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.review.findMany({
      where: { gearItem: { providerId }, isHidden: false },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        customer: { select: { name: true } },
        gearItem: { select: { id: true, name: true } },
      },
    }),
  ]);

  const responseHours = median(
    confirmed.map(
      (order) =>
        (order.confirmedAt!.getTime() - order.createdAt.getTime()) / HOUR_MS,
    ),
  );

  const { latitude, longitude, ...profile } = provider;
  return {
    ...profile,
    location: approximate(latitude, longitude),
    stats: {
      listings: gear.length,
      completedRentals: completed,
      rating: { average: ratings._avg.rating, count: ratings._count.rating },
      responseHours:
        responseHours === null ? null : Math.round(responseHours * 10) / 10,
    },
    gear: await gearService.getGearCards(gear.map((item) => item.id)),
    reviews: reviews.map(({ customer, ...review }) => ({
      ...review,
      // First name only on a public page.
      customerName: customer.name.split(" ")[0],
    })),
  };
};

export const providerProfileService = { getProviderProfile };
