import { Request, Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import httpStatus from "http-status";
import { sendResponse } from "../utils/sendResponse";

/**
 * In-memory store, so each serverless instance counts on its own. That's
 * enough to stop brute force and runaway scripts; a shared store (e.g.
 * Upstash Redis) is the upgrade if limits ever need to be exact.
 *
 * The Next.js frontend calls this API from its own servers, so many users can
 * share one `req.ip`. Limiters that guard an account therefore also key on the
 * email being tried, so one person's typos never lock out everyone else.
 */
const createLimiter = (
  windowMs: number,
  limit: number,
  message: string,
  keyGenerator?: (req: Request) => string,
) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ...(keyGenerator && { keyGenerator }),
    handler: (_req: Request, res: Response) => {
      sendResponse(res, {
        success: false,
        statusCode: httpStatus.TOO_MANY_REQUESTS,
        message,
        data: null,
      });
    },
  });

const ipAndEmailKey = (req: Request) => {
  const ip = ipKeyGenerator(req.ip ?? "unknown");
  const email =
    typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  return email ? `${ip}:${email}` : ip;
};

/** Signed-in requests count per user; anonymous ones per IP + email. */
const userOrIpAndEmailKey = (req: Request) =>
  req.user ? `user:${req.user.id}` : ipAndEmailKey(req);

const MINUTE = 60 * 1000;

/** Login, register and forgot password — per IP + email. */
export const authLimiter = createLimiter(
  MINUTE,
  10,
  "Too many attempts. Please wait a minute and try again.",
  ipAndEmailKey,
);

/** Google sign-in has no email in the body; a bad code fails at Google anyway. */
export const oauthLimiter = createLimiter(
  MINUTE,
  60,
  "Too many sign-in attempts. Please wait a minute and try again.",
);

/**
 * The visitor behind a public AI request. The frontend calls from its own
 * servers, so it forwards the visitor's IP in `x-client-ip`; anyone can set
 * that header, which is why `aiGlobalLimiter` caps the total as well.
 */
const aiKey = (req: Request) => {
  if (req.user) return `user:${req.user.id}`;
  const forwarded = req.get("x-client-ip")?.trim().slice(0, 64);
  return forwarded ? `client:${forwarded}` : ipKeyGenerator(req.ip ?? "unknown");
};

/** Gemini-backed endpoints, per visitor. */
export const aiLimiter = createLimiter(
  MINUTE,
  8,
  "You're asking quickly — give the AI assistant a minute and try again.",
  aiKey,
);

/** Search-box suggestions, per visitor (debounced and cached client-side). */
export const aiSuggestLimiter = createLimiter(
  MINUTE,
  20,
  "Slow down a little — suggestions will be back in a moment.",
  aiKey,
);

/** Every AI request together: keeps the whole site under the free quota. */
export const aiGlobalLimiter = createLimiter(
  MINUTE,
  30,
  "The AI assistant is busy. Please try again in a minute.",
  () => "global",
);

/**
 * User-generated writes such as messages, contact and newsletter forms.
 * Put it after `auth()` on signed-in routes so it can count per user.
 */
export const writeLimiter = createLimiter(
  MINUTE,
  5,
  "You're doing that too often. Please wait a minute and try again.",
  userOrIpAndEmailKey,
);
