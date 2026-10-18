import { Role } from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { emailService } from "../email/email.service";
import { ICreateContactMessagePayload } from "./contact.interface";

/** `ADMIN_EMAIL` if set, otherwise every admin account. */
const adminRecipients = async () => {
  if (config.admin_email) return [config.admin_email];
  const admins = await prisma.user.findMany({
    where: { role: Role.ADMIN },
    select: { email: true },
  });
  return admins.map((admin) => admin.email);
};

const createMessage = async (payload: ICreateContactMessagePayload) => {
  const recipients = await adminRecipients();
  const subject = payload.subject || null;

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.contactMessage.create({
      data: { ...payload, subject },
    });
    await emailService.enqueue(tx, [
      ...recipients.map((to) => ({
        to,
        template: "contactReceived" as const,
        payload: {
          name: created.name,
          email: created.email,
          subject,
          message: created.message,
        },
      })),
      {
        to: created.email,
        template: "contactAutoReply",
        payload: {
          name: created.name,
          message: created.message,
          locale: created.locale,
        },
      },
    ]);
    return created;
  });
  emailService.dispatchSoon();
  return { id: message.id };
};

export const contactService = { createMessage };
