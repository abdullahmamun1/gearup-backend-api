import { randomBytes } from "node:crypto";
import { Locale } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { createError } from "../../utils/createError";
import { toDateKey } from "../../utils/dates";
import { emailService } from "../email/email.service";

/**
 * Double opt-in: nobody is subscribed until they click the emailed link.
 * Returns "subscribed" when the address is already confirmed.
 */
const subscribe = async (rawEmail: string, locale?: Locale) => {
  const email = rawEmail.trim().toLowerCase();
  const existing = await prisma.subscriber.findUnique({ where: { email } });
  if (existing?.confirmedAt && !existing.unsubscribedAt) {
    return { status: "subscribed" as const };
  }

  const token = existing?.token ?? randomBytes(24).toString("base64url");
  await prisma.$transaction(async (tx) => {
    await tx.subscriber.upsert({
      where: { email },
      update: { ...(locale !== undefined && { locale }) },
      create: { email, token, ...(locale !== undefined && { locale }) },
    });
    await emailService.enqueue(tx, [
      {
        to: email,
        template: "newsletterConfirm",
        payload: {
          url: emailService.appUrl(`/newsletter/confirm?token=${token}`),
          unsubscribeUrl: emailService.appUrl(`/newsletter/unsubscribe?token=${token}`),
          ...(locale !== undefined && { locale }),
        },
        // At most one confirmation email per address per day.
        dedupeKey: `newsletter-confirm:${email}:${toDateKey(new Date())}`,
      },
    ]);
  });
  emailService.dispatchSoon();
  return { status: "pending" as const };
};

const findByToken = async (token: string) => {
  const subscriber = await prisma.subscriber.findUnique({ where: { token } });
  if (!subscriber) {
    throw createError(400, "This link is invalid.");
  }
  return subscriber;
};

const confirm = async (token: string) => {
  const subscriber = await findByToken(token);
  await prisma.subscriber.update({
    where: { id: subscriber.id },
    data: { confirmedAt: subscriber.confirmedAt ?? new Date(), unsubscribedAt: null },
  });
  return { email: subscriber.email };
};

const unsubscribe = async (token: string) => {
  const subscriber = await findByToken(token);
  await prisma.subscriber.update({
    where: { id: subscriber.id },
    data: { unsubscribedAt: subscriber.unsubscribedAt ?? new Date() },
  });
  return { email: subscriber.email };
};

export const newsletterService = { subscribe, confirm, unsubscribe };
