import { CancelReason, UserStatus } from "../../../generated/prisma/enums";

export type OrderAudience = "customer" | "provider";

/** Everything an order email shows. Built by `orderEmailPayload`. */
export interface IOrderEmail {
  orderId: string;
  audience: OrderAudience;
  recipientName: string;
  customerName: string;
  providerName: string;
  items: { name: string; quantity: number }[];
  /** "YYYY-MM-DD"; the end date is the return day. */
  startDate: string;
  endDate: string;
  rental: number;
  deposit: number;
  /** Customer: the order page. Provider: their orders table. */
  url: string;
}

/** Payload stored in the outbox for each template, rendered at send time. */
export interface IEmailPayloads {
  verifyEmail: { name: string; url: string; welcome: boolean };
  resetPassword: { name: string; url: string };
  passwordChanged: { name: string };
  accountStatus: { name: string; status: UserStatus };

  orderPlaced: IOrderEmail & { respondBy: string };
  orderConfirmed: IOrderEmail & { paymentDueAt: string };
  orderCancelled: IOrderEmail & {
    reason: CancelReason;
    note?: string | null;
    refunded: number;
  };
  paymentReceived: IOrderEmail & { paid: number };
  pickupReminder: IOrderEmail;
  orderReturned: IOrderEmail & {
    depositOutcome: "NONE" | "REFUNDED" | "CLAIMED";
    claim?: number;
  };
  reviewRequest: IOrderEmail;

  contactReceived: {
    name: string;
    email: string;
    subject?: string | null;
    message: string;
  };
  contactAutoReply: { name: string; message: string };
  newsletterConfirm: { url: string; unsubscribeUrl: string };
}

export type EmailTemplate = keyof IEmailPayloads;

export type EmailMessage = {
  [K in EmailTemplate]: {
    to: string;
    template: K;
    payload: IEmailPayloads[K];
    /** Unique per email — a second enqueue with the same key is ignored. */
    dedupeKey?: string;
    sendAfter?: Date;
  };
}[EmailTemplate];
