import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application, Request, Response } from "express";
import helmet from "helmet";
import config from "./config";
import { authRoutes } from "./modules/auth/auth.route";
import { globalErrorHandler } from "./middleware/globalErrorHandler";
import { notFound } from "./middleware/notFound";
import { adminRoutes } from "./modules/admin/admin.route";
import { gearRoutes } from "./modules/gear/gear.route";
import { providerRoutes } from "./modules/provider/provider.route";
import { rentalRoutes } from "./modules/rental/rental.route";
import { paymentRoutes } from "./modules/payment/payment.route";
import { reviewRoutes } from "./modules/review/review.route";
import { contactRoutes } from "./modules/contact/contact.route";
import { newsletterRoutes } from "./modules/newsletter/newsletter.route";
import { cronRoutes } from "./modules/cron/cron.route";
import { aiRoutes } from "./modules/ai/ai.route";
import { favoriteRoutes } from "./modules/favorite/favorite.route";
import { messageRoutes } from "./modules/message/message.route";
import { providerProfileRoutes } from "./modules/providerProfile/providerProfile.route";
import { uploadRoutes } from "./modules/upload/upload.route";
import { reportRoutes } from "./modules/report/report.route";
import { claimRoutes } from "./modules/claim/claim.route";
import { inboxRoutes } from "./modules/inbox/inbox.route";

const app: Application = express();

// Behind Vercel's proxy: lets req.ip be the client, not the load balancer.
app.set("trust proxy", 1);
app.use(helmet());

app.use("/api/payments/confirm", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: config.app_url,
    credentials: true,
  }),
);

app.get("/", (req: Request, res: Response) => {
  res.send("GearUp API is running");
});

app.use("/api/", gearRoutes);
app.use("/api/", reviewRoutes);
app.use("/api/admin", adminRoutes, reportRoutes, claimRoutes, inboxRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/provider", providerRoutes);
app.use("/api/rentals", rentalRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/cron", cronRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/providers", providerProfileRoutes);
// Order threads (/rentals/:orderId/messages) and /messages/unread.
app.use("/api", messageRoutes);

app.use(notFound);
app.use(globalErrorHandler);

export default app;
