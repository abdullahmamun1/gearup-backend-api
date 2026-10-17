import nodemailer, { Transporter } from "nodemailer";
import config from "../config";

type Mailer = { transporter: Transporter; from: string; preview: boolean };

let mailer: Promise<Mailer> | null = null;

/**
 * SMTP (Gmail in production) when `SMTP_HOST` is set. In development without
 * it, a throwaway Ethereal inbox: nothing is delivered, and each email's
 * preview link is printed to the log.
 */
const createMailer = async (): Promise<Mailer> => {
  const { host, port, secure, user, pass } = config.smtp;

  if (host) {
    return {
      transporter: nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined,
      }),
      from: config.mail_from || `GearUp <${user}>`,
      preview: false,
    };
  }

  if (config.node_env === "production") {
    throw new Error("SMTP is not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS)");
  }

  const account = await nodemailer.createTestAccount();
  console.log(`[mail] No SMTP_HOST set — using Ethereal test inbox ${account.user}`);
  return {
    transporter: nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass },
    }),
    from: `GearUp <${account.user}>`,
    preview: true,
  };
};

export const sendMail = async (message: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) => {
  mailer ??= createMailer().catch((error) => {
    mailer = null; // let the next attempt retry the setup
    throw error;
  });
  const { transporter, from, preview } = await mailer;

  const info = await transporter.sendMail({ from, ...message });
  if (preview) {
    console.log(`[mail] "${message.subject}" → ${message.to}: ${nodemailer.getTestMessageUrl(info)}`);
  }
  return info;
};
