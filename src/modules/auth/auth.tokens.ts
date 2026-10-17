import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "../../../generated/prisma/client";
import { AuthTokenType } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { createError } from "../../utils/createError";

type Db = typeof prisma | Prisma.TransactionClient;

const TTL_MS: Record<AuthTokenType, number> = {
  VERIFY_EMAIL: 48 * 60 * 60 * 1000,
  RESET_PASSWORD: 30 * 60 * 1000,
};

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/**
 * Creates a one-time token and returns the raw value for the email link.
 * Older unused tokens of the same type stop working, so only the newest
 * link is valid.
 */
const issue = async (db: Db, userId: string, type: AuthTokenType) => {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();

  await db.authToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: now },
  });
  await db.authToken.create({
    data: {
      userId,
      type,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + TTL_MS[type]),
    },
  });
  return token;
};

/** Marks the token used and returns its user id, or throws a 400. */
const consume = async (db: Db, token: string, type: AuthTokenType) => {
  const record = await db.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  const now = new Date();

  if (!record || record.type !== type || record.usedAt) {
    throw createError(400, "This link is invalid or has already been used. Please request a new one.");
  }
  if (record.expiresAt <= now) {
    throw createError(400, "This link has expired. Please request a new one.");
  }

  // Conditional, so two clicks racing each other can't both succeed.
  const claimed = await db.authToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: now },
  });
  if (claimed.count === 0) {
    throw createError(400, "This link has already been used. Please request a new one.");
  }
  return record.userId;
};

/** Housekeeping for the daily cron job. */
const purgeOld = async () => {
  const result = await prisma.authToken.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
  });
  return result.count;
};

export const authTokens = { issue, consume, purgeOld };
