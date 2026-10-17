import { waitUntil } from "@vercel/functions";
import { Prisma } from "../../../generated/prisma/client";
import { CancelReason, EmailStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { sendMail } from "../../lib/mailer";
import { toDateKey } from "../../utils/dates";
import {
  EmailMessage,
  EmailTemplate,
  IEmailPayloads,
  IOrderEmail,
  OrderAudience,
} from "./email.interface";
import { renderTemplate } from "./email.templates";

type Db = typeof prisma | Prisma.TransactionClient;

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 25;
const STUCK_AFTER_MS = 10 * 60 * 1000;

/**
 * Queues emails. Pass the transaction client when there is one, so the email
 * exists exactly when the change that caused it does. Duplicate `dedupeKey`s
 * are skipped silently.
 */
const enqueue = async (db: Db, messages: EmailMessage[]) => {
  if (messages.length === 0) return;
  await db.emailOutbox.createMany({
    data: messages.map((message) => ({
      to: message.to,
      template: message.template,
      payload: message.payload as Prisma.InputJsonValue,
      ...(message.dedupeKey && { dedupeKey: message.dedupeKey }),
      ...(message.sendAfter && { sendAfter: message.sendAfter }),
    })),
    skipDuplicates: true,
  });
};

const backoff = (attempts: number) => 2 ** attempts * 60 * 1000;

/** Sends every due email, oldest first. Safe to run concurrently. */
const dispatchDue = async (limit = BATCH_SIZE) => {
  const due = await prisma.emailOutbox.findMany({
    where: { status: EmailStatus.PENDING, sendAfter: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;
  for (const row of due) {
    // Claim the row; another instance may be sending the same batch.
    const claimed = await prisma.emailOutbox.updateMany({
      where: { id: row.id, status: EmailStatus.PENDING },
      data: { status: EmailStatus.SENDING },
    });
    if (claimed.count === 0) continue;

    try {
      const email = renderTemplate(
        row.template as EmailTemplate,
        row.payload as unknown as IEmailPayloads[EmailTemplate],
      );
      await sendMail({ to: row.to, ...email });
      await prisma.emailOutbox.update({
        where: { id: row.id },
        data: { status: EmailStatus.SENT, sentAt: new Date(), lastError: null },
      });
      sent++;
    } catch (error) {
      const attempts = row.attempts + 1;
      await prisma.emailOutbox.update({
        where: { id: row.id },
        data: {
          attempts,
          lastError: error instanceof Error ? error.message.slice(0, 500) : String(error),
          status: attempts >= MAX_ATTEMPTS ? EmailStatus.FAILED : EmailStatus.PENDING,
          sendAfter: new Date(Date.now() + backoff(attempts)),
        },
      });
      failed++;
      console.error(`[mail] ${row.template} → ${row.to} failed (attempt ${attempts})`, error);
    }
  }
  return { sent, failed };
};

/**
 * Sends after the response. On Vercel, `waitUntil` keeps the function alive
 * until it finishes; locally the promise simply runs in the background.
 */
const dispatchSoon = () => {
  waitUntil(
    dispatchDue().catch((error) => console.error("[mail] dispatch failed", error)),
  );
};

/** A crash mid-send leaves rows in SENDING; give them back to the queue. */
const recoverStuck = async () => {
  const result = await prisma.emailOutbox.updateMany({
    where: {
      status: EmailStatus.SENDING,
      updatedAt: { lt: new Date(Date.now() - STUCK_AFTER_MS) },
    },
    data: { status: EmailStatus.PENDING },
  });
  return result.count;
};

// --------------------------------------------------------- order emails

export const orderEmailInclude = {
  items: { include: { gearItem: { select: { name: true } } } },
  customer: { select: { name: true, email: true } },
  provider: { select: { name: true, email: true } },
} satisfies Prisma.RentalOrderInclude;

type OrderForEmail = Prisma.RentalOrderGetPayload<{
  include: typeof orderEmailInclude;
}>;

const appUrl = (path: string) => `${config.app_url}${path}`;

/** Recipient address and the shared payload for one side of an order. */
const orderRecipient = (order: OrderForEmail, audience: OrderAudience) => {
  const recipient = audience === "customer" ? order.customer : order.provider;
  const payload: IOrderEmail = {
    orderId: order.id,
    audience,
    recipientName: recipient.name,
    customerName: order.customer.name,
    providerName: order.provider.name,
    items: order.items.map((item) => ({
      name: item.gearItem.name,
      quantity: item.quantity,
    })),
    startDate: toDateKey(order.startDate),
    endDate: toDateKey(order.endDate),
    rental: Number(order.totalAmount),
    deposit: Number(order.depositAmount),
    url:
      audience === "customer"
        ? appUrl(`/customer-dashboard/orders/${order.id}`)
        : appUrl("/provider-dashboard/orders"),
  };
  return { to: recipient.email, payload };
};

/** "Order cancelled" for each audience; the dedupe key keeps it to one each. */
const cancellationEmails = (
  order: OrderForEmail,
  reason: CancelReason,
  audiences: OrderAudience[],
  extra: { note?: string | null; refunded?: number } = {},
): EmailMessage[] =>
  audiences.map((audience) => {
    const { to, payload } = orderRecipient(order, audience);
    return {
      to,
      template: "orderCancelled",
      payload: {
        ...payload,
        reason,
        note: extra.note ?? null,
        refunded: audience === "customer" ? (extra.refunded ?? 0) : 0,
      },
      dedupeKey: `cancelled:${order.id}:${audience}`,
    };
  });

const loadOrderForEmail = (db: Db, orderId: string) =>
  db.rentalOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: orderEmailInclude,
  });

export const emailService = {
  enqueue,
  dispatchDue,
  dispatchSoon,
  recoverStuck,
  orderRecipient,
  cancellationEmails,
  loadOrderForEmail,
  appUrl,
};
