import { Locale } from "../../../generated/prisma/enums";
import config from "../../config";

/**
 * One table-based layout for every email, with inline styles only, because
 * most email clients strip <style> blocks. Every dynamic value is escaped:
 * names and notes come from users.
 */

const BRAND = {
  pine: "#1f6b4f",
  ember: "#e2702f",
  lagoon: "#2d7db3",
  ink: "#1c1917",
  muted: "#57534e",
  line: "#e7e5e4",
  canvas: "#f5f5f4",
};

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
/** Bengali system fonts first; Latin text (names, prices) falls through. */
const FONT_BN = `'Noto Sans Bengali', 'Hind Siliguri', Vrinda, 'Bangla Sangam MN', ${FONT}`;

const FOOTER: Record<Locale, { account: string; newsletter: string; unsubscribe: string; tagline: string; signOff: string }> = {
  en: {
    account: "You're receiving this because of activity on your GearUp account.",
    newsletter: "You're receiving this because you subscribed to GearUp news.",
    unsubscribe: "Unsubscribe",
    tagline: "GearUp · Rent sports &amp; outdoor gear by the day · Bangladesh",
    signOff: "— GearUp",
  },
  bn: {
    account: "আপনার GearUp অ্যাকাউন্টের কার্যক্রমের কারণে আপনি এই ইমেইলটি পাচ্ছেন।",
    newsletter: "GearUp-এর খবরের জন্য সাবস্ক্রাইব করায় আপনি এই ইমেইলটি পাচ্ছেন।",
    unsubscribe: "আনসাবস্ক্রাইব করুন",
    tagline: "GearUp · দিনপ্রতি খেলাধুলা ও আউটডোর গিয়ার ভাড়া · বাংলাদেশ",
    signOff: "— GearUp",
  },
};

/**
 * Bangla readers get the Bangla pages: "https://site/gear" →
 * "https://site/bn/gear". Only links into the site (not /api) change.
 */
const localizeUrl = (url: string, locale: Locale) => {
  if (locale === "en" || !config.app_url) return url;
  const origin = config.app_url.replace(/\/$/, "");
  if (!url.startsWith(`${origin}/`) && url !== origin) return url;
  const path = url.slice(origin.length) || "/";
  if (path.startsWith("/api/") || path.startsWith(`/${locale}/`) || path === `/${locale}`) {
    return url;
  }
  return `${origin}/${locale}${path === "/" ? "" : path}`;
};

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export type EmailContent = {
  subject: string;
  /** Inbox preview text, shown after the subject. */
  preheader: string;
  heading: string;
  paragraphs: string[];
  /** Label/value pairs, e.g. dates and totals. */
  rows?: [string, string][];
  button?: { label: string; url: string; tone?: "primary" | "cta" };
  /** Small print under the button. */
  note?: string;
  /** Marketing emails must carry one. */
  unsubscribeUrl?: string;
};

export const renderEmail = (content: EmailContent, locale: Locale = "en") => {
  const { preheader, heading, paragraphs, rows, note } = content;
  const words = FOOTER[locale];
  const font = locale === "bn" ? FONT_BN : FONT;
  const button = content.button && {
    ...content.button,
    url: localizeUrl(content.button.url, locale),
  };
  const unsubscribeUrl =
    content.unsubscribeUrl && localizeUrl(content.unsubscribeUrl, locale);

  const paragraphHtml = paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${BRAND.ink};">${escapeHtml(text)}</p>`,
    )
    .join("");

  const rowsHtml = rows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;border-top:1px solid ${BRAND.line};">${rows
        .map(
          ([label, value]) =>
            `<tr><td style="padding:10px 0;border-bottom:1px solid ${BRAND.line};font-size:14px;color:${BRAND.muted};">${escapeHtml(label)}</td><td align="right" style="padding:10px 0;border-bottom:1px solid ${BRAND.line};font-size:14px;color:${BRAND.ink};font-weight:600;">${escapeHtml(value)}</td></tr>`,
        )
        .join("")}</table>`
    : "";

  const buttonColor = button?.tone === "cta" ? BRAND.ember : BRAND.pine;
  const buttonHtml = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;"><tr><td style="border-radius:8px;background:${buttonColor};"><a href="${escapeHtml(button.url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(button.label)}</a></td></tr></table>`
    : "";

  const noteHtml = note
    ? `<p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:${BRAND.muted};">${escapeHtml(note)}</p>`
    : "";

  const footer = unsubscribeUrl
    ? `${words.newsletter} <a href="${escapeHtml(unsubscribeUrl)}" style="color:${BRAND.muted};">${words.unsubscribe}</a>.`
    : words.account;

  const html = `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(content.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.canvas};font-family:${font};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.canvas};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 4px 14px;font-size:18px;font-weight:700;color:${BRAND.pine};">⛰ GearUp</td></tr>
<tr><td style="background:#ffffff;border-radius:14px;border-top:4px solid ${BRAND.pine};padding:28px 26px;">
<h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:${BRAND.ink};">${escapeHtml(heading)}</h1>
${paragraphHtml}${rowsHtml}${buttonHtml}${noteHtml}
</td></tr>
<tr><td style="padding:16px 6px;font-size:12px;line-height:1.5;color:${BRAND.muted};">${footer}<br>${words.tagline}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    heading,
    "",
    ...paragraphs.flatMap((paragraph) => [paragraph, ""]),
    ...(rows ?? []).map(([label, value]) => `${label}: ${value}`),
    ...(rows?.length ? [""] : []),
    ...(button ? [`${button.label}: ${button.url}`, ""] : []),
    ...(note ? [note, ""] : []),
    ...(unsubscribeUrl ? [`${words.unsubscribe}: ${unsubscribeUrl}`] : []),
    words.signOff,
  ].join("\n");

  return { subject: content.subject, html, text };
};
