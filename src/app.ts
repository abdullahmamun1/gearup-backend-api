import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application, Request, Response } from "express";
import config from "./config";
import { authRoutes } from "./modules/auth/auth.route";
import { globalErrorHandler } from "./middleware/globalErrorHandler";
import { notFound } from "./middleware/notFound";
import { adminRoutes } from "./modules/admin/admin.route";
import { gearRoutes } from "./modules/gear/gear.route";
import { providerRoutes } from "./modules/provider/provider.route";

const app: Application = express();

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
  res.send("Hello, World!!!");
});

app.use("/api/", gearRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/provider", providerRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(globalErrorHandler);

export default app;
