import { CancelReason, Locale } from "../../../generated/prisma/enums";
import { emailFormat } from "./email.format";
import { EmailContent, renderEmail } from "./email.layout";
import { EmailTemplate, IEmailPayloads, IOrderEmail } from "./email.interface";
import { bnBuilders } from "./email.templates.bn";

// ---------------------------------------------------------- formatting

const format = emailFormat("en");
const formatMoney = format.money;
const formatDay = format.day;
const formatDeadline = format.deadline;
const dayCount = format.dayCount;
const itemsLabel = format.items;
const shortId = format.shortId;

/** The rows every order email shares. */
const orderRows = (order: IOrderEmail): [string, string][] => {
  const days = dayCount(order);
  const rows: [string, string][] = [
    ["Gear", itemsLabel(order)],
    ["Pick up", formatDay(order.startDate)],
    ["Return", formatDay(order.endDate)],
    ["Rental", `${formatMoney(order.rental)} · ${days} ${days === 1 ? "day" : "days"}`],
  ];
  if (order.deposit > 0) {
    rows.push(["Refundable deposit", formatMoney(order.deposit)]);
  }
  rows.push(
    order.audience === "customer"
      ? ["Provider", order.providerName]
      : ["Customer", order.customerName],
  );
  return rows;
};

const hi = (name: string) => `Hi ${name.split(/\s+/)[0] || "there"},`;

const CANCEL_REASON_TEXT: Record<CancelReason, string> = {
  CUSTOMER: "The customer cancelled it.",
  PROVIDER_DECLINED: "The provider wasn't able to take it.",
  PAYMENT_EXPIRED: "Payment wasn't completed in time, so the dates were released.",
  NO_PROVIDER_RESPONSE: "The provider didn't respond in time, so the request expired.",
  ADMIN: "GearUp cancelled it.",
};

const cancelReasonText = (order: IOrderEmail & { reason: CancelReason }) =>
  order.reason === "CUSTOMER" && order.audience === "customer"
    ? "You cancelled it."
    : order.reason === "PROVIDER_DECLINED" && order.audience === "provider"
      ? "You declined it."
      : CANCEL_REASON_TEXT[order.reason];

// ----------------------------------------------------------- templates

export type Builders = {
  [K in EmailTemplate]: (payload: IEmailPayloads[K]) => EmailContent;
};

const enBuilders: Builders = {
  verifyEmail: ({ name, url, welcome }) => ({
    subject: welcome ? "Welcome to GearUp — confirm your email" : "Confirm your email address",
    preheader: "One click to confirm it's really you.",
    heading: welcome ? "Welcome to GearUp!" : "Confirm your email",
    paragraphs: [
      hi(name),
      welcome
        ? "Thanks for joining. Confirm your email address so you can pay for rentals and publish listings."
        : "Click the button below to confirm your email address.",
    ],
    button: { label: "Confirm my email", url },
    note: "The link works for 48 hours. If you didn't create a GearUp account, you can ignore this email.",
  }),

  resetPassword: ({ name, url }) => ({
    subject: "Reset your GearUp password",
    preheader: "This link works for 30 minutes.",
    heading: "Reset your password",
    paragraphs: [hi(name), "Someone (hopefully you) asked to reset the password for your GearUp account."],
    button: { label: "Choose a new password", url },
    note: "The link works once, for 30 minutes. If you didn't ask for this, ignore this email — your password stays the same.",
  }),

  passwordChanged: ({ name }) => ({
    subject: "Your GearUp password was changed",
    preheader: "If this wasn't you, reset it now.",
    heading: "Password changed",
    paragraphs: [
      hi(name),
      "Your password was just changed, and you've been signed out on your other devices.",
      "If you didn't do this, reset your password straight away and contact us.",
    ],
  }),

  accountStatus: ({ name, status }) =>
    status === "SUSPENDED"
      ? {
          subject: "Your GearUp account has been suspended",
          preheader: "You can't sign in for now.",
          heading: "Account suspended",
          paragraphs: [
            hi(name),
            "Your GearUp account has been suspended, so you can't sign in or place orders for now.",
            "If you think this is a mistake, reply to this email or use the contact form on our website.",
          ],
        }
      : {
          subject: "Your GearUp account is active again",
          preheader: "Welcome back.",
          heading: "Account reactivated",
          paragraphs: [hi(name), "Your GearUp account is active again. You can sign in and rent as usual."],
        },

  orderPlaced: (order) =>
    order.audience === "customer"
      ? {
          subject: `Request sent: ${itemsLabel(order)}`,
          preheader: `${order.providerName} will confirm by ${formatDeadline(order.respondBy)}.`,
          heading: "Your rental request is in",
          paragraphs: [
            hi(order.recipientName),
            `${order.providerName} has until ${formatDeadline(order.respondBy)} to confirm. You'll only pay once they do — nothing has been charged yet.`,
          ],
          rows: orderRows(order),
          button: { label: "View your request", url: order.url },
          note: `Order ${shortId(order)}`,
        }
      : {
          subject: `New rental request: ${itemsLabel(order)}`,
          preheader: `Respond by ${formatDeadline(order.respondBy)}.`,
          heading: "You have a new rental request",
          paragraphs: [
            hi(order.recipientName),
            `${order.customerName} wants to rent your gear. Please confirm or decline by ${formatDeadline(order.respondBy)} — after that the request expires.`,
          ],
          rows: orderRows(order),
          button: { label: "Respond to the request", url: order.url, tone: "cta" },
          note: `Order ${shortId(order)}`,
        },

  orderConfirmed: (order) => ({
    subject: `Confirmed — pay by ${formatDeadline(order.paymentDueAt)}`,
    preheader: "Pay to lock in your dates.",
    heading: "Your rental is confirmed",
    paragraphs: [
      hi(order.recipientName),
      `${order.providerName} confirmed your request. Pay by ${formatDeadline(order.paymentDueAt)} to lock in your dates — after that they're released to other renters.`,
    ],
    rows: [...orderRows(order), ["Due now", formatMoney(order.rental + order.deposit)]],
    button: { label: "Pay now", url: order.url, tone: "cta" },
    note: "Free cancellation until you pay.",
  }),

  orderCancelled: (order) => ({
    subject: `Cancelled: ${itemsLabel(order)}`,
    preheader: cancelReasonText(order),
    heading: "This rental was cancelled",
    paragraphs: [
      hi(order.recipientName),
      `Order ${shortId(order)} for ${formatDay(order.startDate)} has been cancelled. ${cancelReasonText(order)}`,
      ...(order.note ? [`Note: “${order.note}”`] : []),
      ...(order.refunded > 0 && order.audience === "customer"
        ? [`We've refunded ${formatMoney(order.refunded)} to your card. It usually arrives within 5–10 business days.`]
        : []),
      ...(order.audience === "provider" ? ["Those dates are free again for other renters."] : []),
    ],
    rows: orderRows(order),
    button:
      order.audience === "customer"
        ? { label: "Find other gear", url: new URL("/gear", order.url).toString() }
        : { label: "Open your orders", url: order.url },
  }),

  paymentReceived: (order) =>
    order.audience === "customer"
      ? {
          subject: `Payment received — you're all set for ${formatDay(order.startDate)}`,
          preheader: `${formatMoney(order.paid)} paid.`,
          heading: "Payment received",
          paragraphs: [
            hi(order.recipientName),
            `Thanks — your payment of ${formatMoney(order.paid)} went through. ${order.providerName} will arrange pickup with you.`,
            "Need to cancel? You get a full refund up to 24 hours before the start day.",
          ],
          rows: [...orderRows(order), ["Paid", formatMoney(order.paid)]],
          button: { label: "View your rental", url: order.url },
        }
      : {
          subject: `Paid: ${itemsLabel(order)} on ${formatDay(order.startDate)}`,
          preheader: "Get the gear ready for pickup.",
          heading: "A rental has been paid",
          paragraphs: [
            hi(order.recipientName),
            `${order.customerName} paid for their rental. Please get the gear ready and arrange pickup.`,
          ],
          rows: orderRows(order),
          button: { label: "Open your orders", url: order.url },
        },

  pickupReminder: (order) => ({
    subject: `Tomorrow: ${itemsLabel(order)}`,
    preheader: "Pickup is tomorrow.",
    heading: "Pickup is tomorrow",
    paragraphs: [
      hi(order.recipientName),
      order.audience === "customer"
        ? `Your rental from ${order.providerName} starts tomorrow. Check the gear when you collect it and report anything that's wrong straight away.`
        : `${order.customerName} picks up tomorrow. Please have the gear clean and ready.`,
    ],
    rows: orderRows(order),
    button: { label: "View the order", url: order.url },
  }),

  orderReturned: (order) => ({
    subject: "Return recorded — thanks for renting with GearUp",
    preheader:
      order.depositOutcome === "REFUNDED"
        ? "Your deposit is on its way back."
        : "Your rental is complete.",
    heading: "Your rental is complete",
    paragraphs: [
      hi(order.recipientName),
      `${order.providerName} recorded the return of your gear.`,
      ...(order.depositOutcome === "REFUNDED"
        ? [`Your ${formatMoney(order.deposit)} deposit has been refunded to your card. It usually arrives within 5–10 business days.`]
        : order.depositOutcome === "CLAIMED"
          ? [
              `The provider reported damage and claimed ${formatMoney(order.claim ?? 0)} of your ${formatMoney(order.deposit)} deposit. GearUp reviews every claim before any of your deposit is kept, and we'll email you the outcome.`,
            ]
          : []),
    ],
    rows: orderRows(order),
    button: { label: "View the rental", url: order.url },
  }),

  reviewRequest: (order) => ({
    subject: `How was the ${order.items[0]?.name ?? "gear"}?`,
    preheader: "Your review helps other renters.",
    heading: "How did your rental go?",
    paragraphs: [
      hi(order.recipientName),
      `You recently rented ${itemsLabel(order)} from ${order.providerName}. A quick review helps other renters choose — and helps good providers stand out.`,
    ],
    button: { label: "Write a review", url: order.url, tone: "cta" },
  }),

  claimResolved: (order) => {
    const customer = order.audience === "customer";
    const outcome =
      order.kept === 0
        ? customer
          ? `Good news: we reviewed the damage claim on your rental and your full ${formatMoney(order.deposit)} deposit has been refunded.`
          : `We reviewed your damage claim and decided not to keep any of the ${formatMoney(order.deposit)} deposit. It has been refunded to ${order.customerName}.`
        : order.refunded === 0
          ? customer
            ? `We reviewed the damage claim on your rental and upheld it: the ${formatMoney(order.kept)} deposit has been kept to cover the damage.`
            : `We upheld your damage claim. The full ${formatMoney(order.kept)} deposit is kept to cover the damage.`
          : customer
            ? `We reviewed the damage claim on your rental. ${formatMoney(order.kept)} of your deposit is kept to cover the damage and the other ${formatMoney(order.refunded)} has been refunded to your card.`
            : `We reviewed your damage claim. ${formatMoney(order.kept)} of the deposit is kept to cover the damage and ${formatMoney(order.refunded)} has been refunded to ${order.customerName}.`;
    return {
      subject: `Damage claim decided — order ${shortId(order)}`,
      preheader: "We've reviewed the damage claim.",
      heading: "The damage claim is settled",
      paragraphs: [
        hi(order.recipientName),
        outcome,
        ...(order.note ? [`Note from the GearUp team: “${order.note}”`] : []),
        ...(customer && order.refunded > 0
          ? ["Refunds usually arrive within 5–10 business days."]
          : []),
      ],
      rows: [
        ...orderRows(order),
        ["Deposit kept", formatMoney(order.kept)],
        ["Deposit refunded", formatMoney(order.refunded)],
      ],
      button: { label: "View the order", url: order.url },
    };
  },

  newMessage: ({ recipientName, senderName, gearName, preview, url }) => ({
    subject: `New message from ${senderName} about ${gearName}`,
    preheader: preview.slice(0, 90),
    heading: `${senderName} sent you a message`,
    paragraphs: [hi(recipientName), `“${preview}”`],
    button: { label: "Open the conversation", url, tone: "primary" },
    note: "We send at most one of these an hour per conversation. Reply on GearUp, not by email.",
  }),

  contactReceived: ({ name, email, subject, message }) => ({
    subject: `Contact form: ${subject || `message from ${name}`}`,
    preheader: message.slice(0, 90),
    heading: "New contact form message",
    paragraphs: [message],
    rows: [
      ["From", name],
      ["Email", email],
      ...(subject ? ([["Subject", subject]] as [string, string][]) : []),
    ],
    note: "Reply directly to the sender's address above.",
  }),

  contactAutoReply: ({ name, message }) => ({
    subject: "We got your message",
    preheader: "We usually reply within a day.",
    heading: "Thanks for getting in touch",
    paragraphs: [
      hi(name),
      "Your message reached the GearUp team. We usually reply within one working day.",
      `Your message: “${message.length > 400 ? `${message.slice(0, 400)}…` : message}”`,
    ],
  }),

  contactReply: ({ name, subject, reply, original }) => ({
    subject: subject ? `Re: ${subject}` : "Re: your message to GearUp",
    preheader: reply.slice(0, 90),
    heading: "A reply from the GearUp team",
    paragraphs: [
      hi(name),
      ...reply.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean),
      `You wrote: “${original.length > 400 ? `${original.slice(0, 400)}…` : original}”`,
    ],
    note: "You can reply to this email, or send us a new message from the contact page.",
  }),

  newsletterConfirm: ({ url, unsubscribeUrl }) => ({
    subject: "Confirm your GearUp newsletter subscription",
    preheader: "One click and you're in.",
    heading: "Confirm your subscription",
    paragraphs: [
      "Thanks for signing up for GearUp news — new gear, trip ideas and the occasional deal. Please confirm it was you.",
    ],
    button: { label: "Yes, subscribe me", url },
    note: "If you didn't sign up, ignore this email and you won't hear from us.",
    unsubscribeUrl,
  }),
};

const BUILDERS: Record<Locale, Builders> = { en: enBuilders, bn: bnBuilders };

/** Renders in the recipient's language (rendered at send time). */
export const renderTemplate = <K extends EmailTemplate>(
  template: K,
  payload: IEmailPayloads[K],
  locale: Locale = "en",
) => renderEmail(BUILDERS[locale][template](payload), locale);
