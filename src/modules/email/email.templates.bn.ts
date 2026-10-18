import { CancelReason } from "../../../generated/prisma/enums";
import { emailFormat } from "./email.format";
import { IOrderEmail } from "./email.interface";
import type { Builders } from "./email.templates";

/**
 * Bangla versions of every email (same structure as the English builders in
 * email.templates.ts; keep the two in step). User content (names, gear,
 * notes, messages) stays as written.
 */

const f = emailFormat("bn");

const days = (count: number) => `${f.number(count)} দিন`;

const orderRows = (order: IOrderEmail): [string, string][] => {
  const rows: [string, string][] = [
    ["গিয়ার", f.items(order)],
    ["পিকআপ", f.day(order.startDate)],
    ["ফেরত", f.day(order.endDate)],
    ["ভাড়া", `${f.money(order.rental)} · ${days(f.dayCount(order))}`],
  ];
  if (order.deposit > 0) {
    rows.push(["ফেরতযোগ্য জামানত", f.money(order.deposit)]);
  }
  rows.push(
    order.audience === "customer"
      ? ["প্রোভাইডার", order.providerName]
      : ["গ্রাহক", order.customerName],
  );
  return rows;
};

const hi = (name: string) => {
  const first = f.firstName(name);
  return first ? `প্রিয় ${first},` : "হ্যালো,";
};

const CANCEL_REASON_TEXT: Record<CancelReason, string> = {
  CUSTOMER: "গ্রাহক এটি বাতিল করেছেন।",
  PROVIDER_DECLINED: "প্রোভাইডার এটি নিতে পারেননি।",
  PAYMENT_EXPIRED: "সময়মতো পেমেন্ট সম্পন্ন হয়নি, তাই তারিখগুলো আবার খালি করে দেওয়া হয়েছে।",
  NO_PROVIDER_RESPONSE: "প্রোভাইডার সময়মতো সাড়া দেননি, তাই অনুরোধটির মেয়াদ শেষ হয়ে গেছে।",
  ADMIN: "GearUp এটি বাতিল করেছে।",
};

const cancelReasonText = (order: IOrderEmail & { reason: CancelReason }) =>
  order.reason === "CUSTOMER" && order.audience === "customer"
    ? "আপনি এটি বাতিল করেছেন।"
    : order.reason === "PROVIDER_DECLINED" && order.audience === "provider"
      ? "আপনি এটি প্রত্যাখ্যান করেছেন।"
      : CANCEL_REASON_TEXT[order.reason];

const REFUND_TIMING = "সাধারণত ৫–১০ কার্যদিবসের মধ্যে টাকা পৌঁছে যায়।";

export const bnBuilders: Builders = {
  verifyEmail: ({ name, url, welcome }) => ({
    subject: welcome
      ? "GearUp-এ স্বাগতম — আপনার ইমেইল নিশ্চিত করুন"
      : "আপনার ইমেইল ঠিকানা নিশ্চিত করুন",
    preheader: "এক ক্লিকেই নিশ্চিত করুন যে এটি আপনিই।",
    heading: welcome ? "GearUp-এ স্বাগতম!" : "আপনার ইমেইল নিশ্চিত করুন",
    paragraphs: [
      hi(name),
      welcome
        ? "যোগ দেওয়ার জন্য ধন্যবাদ। ভাড়ার পেমেন্ট করতে ও লিস্টিং প্রকাশ করতে আপনার ইমেইল ঠিকানাটি নিশ্চিত করুন।"
        : "আপনার ইমেইল ঠিকানা নিশ্চিত করতে নিচের বাটনে ক্লিক করুন।",
    ],
    button: { label: "আমার ইমেইল নিশ্চিত করুন", url },
    note: "লিংকটি ৪৮ ঘণ্টা কাজ করবে। আপনি GearUp অ্যাকাউন্ট না খুলে থাকলে এই ইমেইলটি উপেক্ষা করুন।",
  }),

  resetPassword: ({ name, url }) => ({
    subject: "আপনার GearUp পাসওয়ার্ড রিসেট করুন",
    preheader: "এই লিংকটি ৩০ মিনিট কাজ করবে।",
    heading: "পাসওয়ার্ড রিসেট করুন",
    paragraphs: [
      hi(name),
      "কেউ (আশা করি আপনিই) আপনার GearUp অ্যাকাউন্টের পাসওয়ার্ড রিসেট করার অনুরোধ করেছেন।",
    ],
    button: { label: "নতুন পাসওয়ার্ড দিন", url },
    note: "লিংকটি একবারই, ৩০ মিনিটের জন্য কাজ করবে। আপনি অনুরোধ না করে থাকলে এই ইমেইলটি উপেক্ষা করুন — আপনার পাসওয়ার্ড একই থাকবে।",
  }),

  passwordChanged: ({ name }) => ({
    subject: "আপনার GearUp পাসওয়ার্ড পরিবর্তন করা হয়েছে",
    preheader: "এটি আপনি না করে থাকলে এখনই রিসেট করুন।",
    heading: "পাসওয়ার্ড পরিবর্তন হয়েছে",
    paragraphs: [
      hi(name),
      "আপনার পাসওয়ার্ড এইমাত্র পরিবর্তন করা হয়েছে, এবং আপনার অন্যান্য ডিভাইস থেকে আপনাকে লগ আউট করা হয়েছে।",
      "এটি আপনি না করে থাকলে এখনই পাসওয়ার্ড রিসেট করুন এবং আমাদের সাথে যোগাযোগ করুন।",
    ],
  }),

  accountStatus: ({ name, status }) =>
    status === "SUSPENDED"
      ? {
          subject: "আপনার GearUp অ্যাকাউন্ট স্থগিত করা হয়েছে",
          preheader: "আপাতত আপনি লগ ইন করতে পারবেন না।",
          heading: "অ্যাকাউন্ট স্থগিত",
          paragraphs: [
            hi(name),
            "আপনার GearUp অ্যাকাউন্ট স্থগিত করা হয়েছে, তাই আপাতত আপনি লগ ইন বা অর্ডার করতে পারবেন না।",
            "এটি ভুল মনে হলে এই ইমেইলের উত্তর দিন অথবা আমাদের ওয়েবসাইটের যোগাযোগ ফর্ম ব্যবহার করুন।",
          ],
        }
      : {
          subject: "আপনার GearUp অ্যাকাউন্ট আবার সক্রিয়",
          preheader: "আবার স্বাগতম।",
          heading: "অ্যাকাউন্ট পুনরায় সক্রিয়",
          paragraphs: [
            hi(name),
            "আপনার GearUp অ্যাকাউন্ট আবার সক্রিয় হয়েছে। আপনি আগের মতোই লগ ইন করে ভাড়া নিতে পারবেন।",
          ],
        },

  orderPlaced: (order) =>
    order.audience === "customer"
      ? {
          subject: `অনুরোধ পাঠানো হয়েছে: ${f.items(order)}`,
          preheader: `${order.providerName} ${f.deadline(order.respondBy)}-এর মধ্যে নিশ্চিত করবেন।`,
          heading: "আপনার ভাড়ার অনুরোধ পৌঁছেছে",
          paragraphs: [
            hi(order.recipientName),
            `${order.providerName} ${f.deadline(order.respondBy)} পর্যন্ত নিশ্চিত করার সময় পাবেন। তাঁরা নিশ্চিত করার পরই আপনি পেমেন্ট করবেন — এখনো কোনো টাকা কাটা হয়নি।`,
          ],
          rows: orderRows(order),
          button: { label: "আপনার অনুরোধ দেখুন", url: order.url },
          note: `অর্ডার ${f.shortId(order)}`,
        }
      : {
          subject: `নতুন ভাড়ার অনুরোধ: ${f.items(order)}`,
          preheader: `${f.deadline(order.respondBy)}-এর মধ্যে সাড়া দিন।`,
          heading: "আপনার একটি নতুন ভাড়ার অনুরোধ এসেছে",
          paragraphs: [
            hi(order.recipientName),
            `${order.customerName} আপনার গিয়ার ভাড়া নিতে চান। অনুগ্রহ করে ${f.deadline(order.respondBy)}-এর মধ্যে নিশ্চিত বা প্রত্যাখ্যান করুন — এরপর অনুরোধটির মেয়াদ শেষ হয়ে যাবে।`,
          ],
          rows: orderRows(order),
          button: { label: "অনুরোধে সাড়া দিন", url: order.url, tone: "cta" },
          note: `অর্ডার ${f.shortId(order)}`,
        },

  orderConfirmed: (order) => ({
    subject: `নিশ্চিত হয়েছে — ${f.deadline(order.paymentDueAt)}-এর মধ্যে পেমেন্ট করুন`,
    preheader: "তারিখগুলো নিশ্চিত রাখতে পেমেন্ট করুন।",
    heading: "আপনার ভাড়া নিশ্চিত হয়েছে",
    paragraphs: [
      hi(order.recipientName),
      `${order.providerName} আপনার অনুরোধ নিশ্চিত করেছেন। তারিখগুলো ধরে রাখতে ${f.deadline(order.paymentDueAt)}-এর মধ্যে পেমেন্ট করুন — এরপর সেগুলো অন্য গ্রাহকদের জন্য খুলে দেওয়া হবে।`,
    ],
    rows: [
      ...orderRows(order),
      ["এখন পরিশোধযোগ্য", f.money(order.rental + order.deposit)],
    ],
    button: { label: "এখনই পেমেন্ট করুন", url: order.url, tone: "cta" },
    note: "পেমেন্ট করার আগ পর্যন্ত বিনা খরচে বাতিল করা যাবে।",
  }),

  orderCancelled: (order) => ({
    subject: `বাতিল: ${f.items(order)}`,
    preheader: cancelReasonText(order),
    heading: "এই ভাড়াটি বাতিল করা হয়েছে",
    paragraphs: [
      hi(order.recipientName),
      `${f.day(order.startDate)} তারিখের অর্ডার ${f.shortId(order)} বাতিল করা হয়েছে। ${cancelReasonText(order)}`,
      ...(order.note ? [`নোট: “${order.note}”`] : []),
      ...(order.refunded > 0 && order.audience === "customer"
        ? [`আমরা আপনার কার্ডে ${f.money(order.refunded)} রিফান্ড করেছি। ${REFUND_TIMING}`]
        : []),
      ...(order.audience === "provider"
        ? ["এই তারিখগুলো আবার অন্য গ্রাহকদের জন্য খালি হয়েছে।"]
        : []),
    ],
    rows: orderRows(order),
    button:
      order.audience === "customer"
        ? { label: "অন্য গিয়ার খুঁজুন", url: new URL("/gear", order.url).toString() }
        : { label: "আপনার অর্ডারগুলো দেখুন", url: order.url },
  }),

  paymentReceived: (order) =>
    order.audience === "customer"
      ? {
          subject: `পেমেন্ট পাওয়া গেছে — ${f.day(order.startDate)}-এর জন্য সব প্রস্তুত`,
          preheader: `${f.money(order.paid)} পরিশোধ করা হয়েছে।`,
          heading: "পেমেন্ট পাওয়া গেছে",
          paragraphs: [
            hi(order.recipientName),
            `ধন্যবাদ — আপনার ${f.money(order.paid)} পেমেন্ট সফল হয়েছে। ${order.providerName} আপনার সাথে পিকআপের ব্যবস্থা করবেন।`,
            "বাতিল করতে চান? শুরুর দিনের ২৪ ঘণ্টা আগ পর্যন্ত বাতিল করলে পুরো টাকা ফেরত পাবেন।",
          ],
          rows: [...orderRows(order), ["পরিশোধিত", f.money(order.paid)]],
          button: { label: "আপনার ভাড়া দেখুন", url: order.url },
        }
      : {
          subject: `পরিশোধিত: ${f.items(order)}, ${f.day(order.startDate)}`,
          preheader: "পিকআপের জন্য গিয়ার প্রস্তুত রাখুন।",
          heading: "একটি ভাড়ার পেমেন্ট সম্পন্ন হয়েছে",
          paragraphs: [
            hi(order.recipientName),
            `${order.customerName} তাঁর ভাড়ার পেমেন্ট করেছেন। অনুগ্রহ করে গিয়ার প্রস্তুত রাখুন এবং পিকআপের ব্যবস্থা করুন।`,
          ],
          rows: orderRows(order),
          button: { label: "আপনার অর্ডারগুলো দেখুন", url: order.url },
        },

  pickupReminder: (order) => ({
    subject: `আগামীকাল: ${f.items(order)}`,
    preheader: "পিকআপ আগামীকাল।",
    heading: "পিকআপ আগামীকাল",
    paragraphs: [
      hi(order.recipientName),
      order.audience === "customer"
        ? `${order.providerName}-এর কাছ থেকে আপনার ভাড়া আগামীকাল শুরু। গিয়ার নেওয়ার সময় ভালো করে দেখে নিন, আর কোনো সমস্যা থাকলে সাথে সাথে জানান।`
        : `${order.customerName} আগামীকাল পিকআপ করবেন। অনুগ্রহ করে গিয়ার পরিষ্কার ও প্রস্তুত রাখুন।`,
    ],
    rows: orderRows(order),
    button: { label: "অর্ডার দেখুন", url: order.url },
  }),

  orderReturned: (order) => ({
    subject: "ফেরত নথিভুক্ত হয়েছে — GearUp-এ ভাড়া নেওয়ার জন্য ধন্যবাদ",
    preheader:
      order.depositOutcome === "REFUNDED"
        ? "আপনার জামানত ফেরত পাঠানো হচ্ছে।"
        : "আপনার ভাড়া সম্পন্ন হয়েছে।",
    heading: "আপনার ভাড়া সম্পন্ন হয়েছে",
    paragraphs: [
      hi(order.recipientName),
      `${order.providerName} আপনার গিয়ার ফেরত পাওয়ার বিষয়টি নথিভুক্ত করেছেন।`,
      ...(order.depositOutcome === "REFUNDED"
        ? [`আপনার ${f.money(order.deposit)} জামানত আপনার কার্ডে ফেরত দেওয়া হয়েছে। ${REFUND_TIMING}`]
        : order.depositOutcome === "CLAIMED"
          ? [
              `প্রোভাইডার ক্ষতির কথা জানিয়েছেন এবং আপনার ${f.money(order.deposit)} জামানত থেকে ${f.money(order.claim ?? 0)} দাবি করেছেন। জামানতের কোনো অংশ রাখার আগে GearUp প্রতিটি দাবি পর্যালোচনা করে, এবং ফলাফল আমরা আপনাকে ইমেইলে জানাব।`,
            ]
          : []),
    ],
    rows: orderRows(order),
    button: { label: "ভাড়াটি দেখুন", url: order.url },
  }),

  reviewRequest: (order) => ({
    subject: `${order.items[0]?.name ?? "গিয়ার"} কেমন লাগল?`,
    preheader: "আপনার রিভিউ অন্য গ্রাহকদের সাহায্য করে।",
    heading: "আপনার ভাড়ার অভিজ্ঞতা কেমন ছিল?",
    paragraphs: [
      hi(order.recipientName),
      `সম্প্রতি আপনি ${order.providerName}-এর কাছ থেকে ${f.items(order)} ভাড়া নিয়েছেন। ছোট্ট একটি রিভিউ অন্য গ্রাহকদের বেছে নিতে সাহায্য করে — আর ভালো প্রোভাইডারদের এগিয়ে রাখে।`,
    ],
    button: { label: "রিভিউ লিখুন", url: order.url, tone: "cta" },
  }),

  claimResolved: (order) => {
    const customer = order.audience === "customer";
    const outcome =
      order.kept === 0
        ? customer
          ? `সুখবর: আমরা আপনার ভাড়ার ক্ষতির দাবিটি পর্যালোচনা করেছি এবং আপনার পুরো ${f.money(order.deposit)} জামানত ফেরত দেওয়া হয়েছে।`
          : `আমরা আপনার ক্ষতির দাবিটি পর্যালোচনা করে ${f.money(order.deposit)} জামানতের কোনো অংশ না রাখার সিদ্ধান্ত নিয়েছি। এটি ${order.customerName}-কে ফেরত দেওয়া হয়েছে।`
        : order.refunded === 0
          ? customer
            ? `আমরা আপনার ভাড়ার ক্ষতির দাবিটি পর্যালোচনা করে তা বহাল রেখেছি: ক্ষতিপূরণ হিসেবে ${f.money(order.kept)} জামানত রাখা হয়েছে।`
            : `আমরা আপনার ক্ষতির দাবি বহাল রেখেছি। ক্ষতিপূরণ হিসেবে পুরো ${f.money(order.kept)} জামানত রাখা হয়েছে।`
          : customer
            ? `আমরা আপনার ভাড়ার ক্ষতির দাবিটি পর্যালোচনা করেছি। ক্ষতিপূরণ হিসেবে আপনার জামানত থেকে ${f.money(order.kept)} রাখা হয়েছে এবং বাকি ${f.money(order.refunded)} আপনার কার্ডে ফেরত দেওয়া হয়েছে।`
            : `আমরা আপনার ক্ষতির দাবিটি পর্যালোচনা করেছি। ক্ষতিপূরণ হিসেবে জামানত থেকে ${f.money(order.kept)} রাখা হয়েছে এবং ${f.money(order.refunded)} ${order.customerName}-কে ফেরত দেওয়া হয়েছে।`;
    return {
      subject: `ক্ষতির দাবির সিদ্ধান্ত — অর্ডার ${f.shortId(order)}`,
      preheader: "আমরা ক্ষতির দাবিটি পর্যালোচনা করেছি।",
      heading: "ক্ষতির দাবির নিষ্পত্তি হয়েছে",
      paragraphs: [
        hi(order.recipientName),
        outcome,
        ...(order.note ? [`GearUp টিমের নোট: “${order.note}”`] : []),
        ...(customer && order.refunded > 0 ? [REFUND_TIMING] : []),
      ],
      rows: [
        ...orderRows(order),
        ["রাখা জামানত", f.money(order.kept)],
        ["ফেরত দেওয়া জামানত", f.money(order.refunded)],
      ],
      button: { label: "অর্ডার দেখুন", url: order.url },
    };
  },

  newMessage: ({ recipientName, senderName, gearName, preview, url }) => ({
    subject: `${gearName} নিয়ে ${senderName}-এর কাছ থেকে নতুন মেসেজ`,
    preheader: preview.slice(0, 90),
    heading: `${senderName} আপনাকে একটি মেসেজ পাঠিয়েছেন`,
    paragraphs: [hi(recipientName), `“${preview}”`],
    button: { label: "কথোপকথন খুলুন", url, tone: "primary" },
    note: "প্রতিটি কথোপকথনের জন্য আমরা ঘণ্টায় সর্বোচ্চ একটি এমন ইমেইল পাঠাই। ইমেইলে নয়, GearUp-এ উত্তর দিন।",
  }),

  contactReceived: ({ name, email, subject, message }) => ({
    subject: `যোগাযোগ ফর্ম: ${subject || `${name}-এর মেসেজ`}`,
    preheader: message.slice(0, 90),
    heading: "যোগাযোগ ফর্ম থেকে নতুন মেসেজ",
    paragraphs: [message],
    rows: [
      ["প্রেরক", name],
      ["ইমেইল", email],
      ...(subject ? ([["বিষয়", subject]] as [string, string][]) : []),
    ],
    note: "উপরের ঠিকানায় সরাসরি প্রেরককে উত্তর দিন।",
  }),

  contactAutoReply: ({ name, message }) => ({
    subject: "আপনার মেসেজ আমরা পেয়েছি",
    preheader: "আমরা সাধারণত এক দিনের মধ্যে উত্তর দিই।",
    heading: "যোগাযোগের জন্য ধন্যবাদ",
    paragraphs: [
      hi(name),
      "আপনার মেসেজ GearUp টিমের কাছে পৌঁছেছে। আমরা সাধারণত এক কার্যদিবসের মধ্যে উত্তর দিই।",
      `আপনার মেসেজ: “${message.length > 400 ? `${message.slice(0, 400)}…` : message}”`,
    ],
  }),

  contactReply: ({ name, subject, reply, original }) => ({
    subject: subject ? `Re: ${subject}` : "Re: GearUp-এ পাঠানো আপনার মেসেজ",
    preheader: reply.slice(0, 90),
    heading: "GearUp টিমের উত্তর",
    paragraphs: [
      hi(name),
      ...reply
        .split(/\n{2,}/)
        .map((part) => part.trim())
        .filter(Boolean),
      `আপনি লিখেছিলেন: “${original.length > 400 ? `${original.slice(0, 400)}…` : original}”`,
    ],
    note: "এই ইমেইলের উত্তর দিতে পারেন, অথবা যোগাযোগ পেজ থেকে আমাদের নতুন মেসেজ পাঠাতে পারেন।",
  }),

  newsletterConfirm: ({ url, unsubscribeUrl }) => ({
    subject: "আপনার GearUp নিউজলেটার সাবস্ক্রিপশন নিশ্চিত করুন",
    preheader: "এক ক্লিকেই যুক্ত হয়ে যান।",
    heading: "সাবস্ক্রিপশন নিশ্চিত করুন",
    paragraphs: [
      "GearUp-এর খবরের জন্য সাইন আপ করায় ধন্যবাদ — নতুন গিয়ার, ভ্রমণের আইডিয়া আর মাঝে মাঝে বিশেষ অফার। অনুগ্রহ করে নিশ্চিত করুন যে এটি আপনিই।",
    ],
    button: { label: "হ্যাঁ, সাবস্ক্রাইব করুন", url },
    note: "আপনি সাইন আপ না করে থাকলে এই ইমেইলটি উপেক্ষা করুন, আমরা আর যোগাযোগ করব না।",
    unsubscribeUrl,
  }),
};
