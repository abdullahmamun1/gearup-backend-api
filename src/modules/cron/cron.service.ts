import { RentalStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { DAY_MS, addDays, today } from "../../utils/dates";
import { aiService } from "../ai/ai.service";
import { authTokens } from "../auth/auth.tokens";
import { EmailMessage } from "../email/email.interface";
import { emailService, orderEmailInclude } from "../email/email.service";
import { rentalService } from "../rental/rental.service";

/** PAID orders that start tomorrow (Dhaka time), to both sides. */
const queuePickupReminders = async () => {
  const tomorrow = addDays(today(), 1);
  const orders = await prisma.rentalOrder.findMany({
    where: { status: RentalStatus.PAID, startDate: tomorrow },
    include: orderEmailInclude,
  });

  const messages: EmailMessage[] = orders.flatMap((order) =>
    (["customer", "provider"] as const).map((audience) => {
      const { to, payload } = emailService.orderRecipient(order, audience);
      return {
        to,
        template: "pickupReminder" as const,
        payload,
        dedupeKey: `pickup-reminder:${order.id}:${audience}`,
      };
    }),
  );
  await emailService.enqueue(prisma, messages);
  return orders.length;
};

/** Returned 1–8 days ago and not reviewed yet. The key sends it once. */
const queueReviewRequests = async () => {
  const now = Date.now();
  const orders = await prisma.rentalOrder.findMany({
    where: {
      status: RentalStatus.RETURNED,
      review: null,
      returnedAt: {
        gte: new Date(now - 8 * DAY_MS),
        lte: new Date(now - DAY_MS),
      },
    },
    include: orderEmailInclude,
  });

  await emailService.enqueue(
    prisma,
    orders.map((order) => {
      const { to, payload } = emailService.orderRecipient(order, "customer");
      return {
        to,
        template: "reviewRequest" as const,
        payload,
        dedupeKey: `review-request:${order.id}`,
      };
    }),
  );
  return orders.length;
};

/**
 * The once-a-day job (Vercel Hobby allows one cron run per day). Each step is
 * idempotent, so running it twice, or by hand, is harmless.
 */
const runDaily = async () => {
  const expired = await rentalService.expireStaleOrders(true);
  const pickupReminders = await queuePickupReminders();
  const reviewRequests = await queueReviewRequests();
  const recoveredEmails = await emailService.recoverStuck();
  const purgedTokens = await authTokens.purgeOld();
  // A few at a time keeps the run short and inside the free AI quota.
  const reviewSummaries = await aiService.refreshStaleSummaries(10);

  let sent = 0;
  let failed = 0;
  for (let batch = 0; batch < 8; batch++) {
    const result = await emailService.dispatchDue();
    sent += result.sent;
    failed += result.failed;
    if (result.sent + result.failed === 0) break;
  }

  return {
    expired,
    pickupReminders,
    reviewRequests,
    recoveredEmails,
    purgedTokens,
    reviewSummaries,
    emails: { sent, failed },
  };
};

export const cronService = { runDaily };
