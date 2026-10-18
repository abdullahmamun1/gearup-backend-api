import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  node_env: process.env.NODE_ENV || "development",
  port: process.env.PORT || 5000,
  database_url: process.env.DATABASE_URL,
  app_url: process.env.APP_URL,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  jwt_access_secret: process.env.JWT_ACCESS_SECRET!,
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET!,
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN!,
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN!,
  stripe_secret_key: process.env.STRIPE_SECRET_KEY!,
  stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET!,
  google_client_id: process.env.GOOGLE_CLIENT_ID!,
  google_client_secret: process.env.GOOGLE_CLIENT_SECRET!,
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: (process.env.SMTP_SECURE ?? "true") !== "false",
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  /** e.g. `GearUp <you@gmail.com>`. Gmail only sends as your own address. */
  mail_from: process.env.MAIL_FROM,
  /** Where contact-form messages go. Falls back to every admin account. */
  admin_email: process.env.ADMIN_EMAIL,
  /** Vercel sends it as `Authorization: Bearer <CRON_SECRET>`. */
  cron_secret: process.env.CRON_SECRET,
  /** Signed direct uploads from the browser. Missing: uploads answer 503. */
  cloudinary: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  },
  gemini: {
    /** Free key from Google AI Studio. Without it the AI endpoints answer 503. */
    api_key: process.env.GEMINI_API_KEY,
    /**
     * An alias that follows Google's current free Flash-Lite model: fast
     * enough for chat (full Flash with thinking took ~5x longer).
     */
    model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
    /** MINIMAL, LOW, MEDIUM or HIGH. Lower answers faster. */
    thinking: (process.env.GEMINI_THINKING || "LOW").toUpperCase(),
  },
};
