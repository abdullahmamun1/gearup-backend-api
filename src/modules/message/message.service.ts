import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { createError } from "../../utils/createError";
import { emailService } from "../email/email.service";

const HOUR_MS = 60 * 60 * 1000;
const PAGE = 200;

const senderSelect = {
  select: { id: true, name: true, role: true, avatarUrl: true },
} as const;

/**
 * Only the order's customer and its provider can see or write the thread.
 * Anyone else gets a 404, so order ids can't be probed.
 */
const loadOrderFor = async (orderId: string, userId: string) => {
  const order = await prisma.rentalOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerId: true,
      providerId: true,
      customer: { select: { id: true, name: true, email: true } },
      provider: { select: { id: true, name: true, email: true } },
      items: { take: 1, select: { gearItem: { select: { name: true } } } },
    },
  });
  if (!order || (order.customerId !== userId && order.providerId !== userId)) {
    throw createError(httpStatus.NOT_FOUND, "Order not found");
  }
  return order;
};

const getMessages = async (orderId: string, userId: string) => {
  await loadOrderFor(orderId, userId);
  const messages = await prisma.message.findMany({
    where: { rentalOrderId: orderId },
    orderBy: { createdAt: "asc" },
    take: PAGE,
    include: { sender: senderSelect },
  });
  return messages;
};

const sendMessage = async (orderId: string, userId: string, body: string) => {
  const order = await loadOrderFor(orderId, userId);
  const fromCustomer = order.customerId === userId;
  const sender = fromCustomer ? order.customer : order.provider;
  const recipient = fromCustomer ? order.provider : order.customer;

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: { rentalOrderId: orderId, senderId: userId, body },
      include: { sender: senderSelect },
    });
    // One email per conversation per hour per recipient: the key repeats
    // within the hour, so later messages in it are skipped.
    const hourBucket = Math.floor(Date.now() / HOUR_MS);
    await emailService.enqueue(tx, [
      {
        to: recipient.email,
        template: "newMessage",
        payload: {
          recipientName: recipient.name,
          senderName: sender.name,
          gearName: order.items[0]?.gearItem.name ?? "your rental",
          preview: body.length > 160 ? `${body.slice(0, 157)}…` : body,
          url: emailService.appUrl(
            fromCustomer
              ? `/dashboard/provider/orders/${orderId}`
              : `/dashboard/customer/orders/${orderId}`,
          ),
        },
        dedupeKey: `message:${orderId}:${recipient.id}:${hourBucket}`,
      },
    ]);
    return created;
  });
  emailService.dispatchSoon();
  return message;
};

/** The other side's messages up to now count as read. */
const markRead = async (orderId: string, userId: string) => {
  await loadOrderFor(orderId, userId);
  const result = await prisma.message.updateMany({
    where: { rentalOrderId: orderId, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });
  return { marked: result.count };
};

/** Unread messages sent to this user, per order, for badges. */
const getUnread = async (userId: string) => {
  const rows = await prisma.message.groupBy({
    by: ["rentalOrderId"],
    where: {
      readAt: null,
      senderId: { not: userId },
      rentalOrder: { OR: [{ customerId: userId }, { providerId: userId }] },
    },
    _count: { _all: true },
  });
  const byOrder = Object.fromEntries(
    rows.map((row) => [row.rentalOrderId, row._count._all]),
  );
  const total = rows.reduce((sum, row) => sum + row._count._all, 0);
  return { total, byOrder };
};

export const messageService = { getMessages, sendMessage, markRead, getUnread };
