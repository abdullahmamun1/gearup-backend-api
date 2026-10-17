import bcrypt from "bcryptjs";
import {
  ICreateUserPayload,
  IGoogleLoginPayload,
  ILoginPayload,
  IUpdateProfilePayload,
} from "./auth.interface";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { safeUserSelect } from "../../utils/userSelect";
import { jwtUtils } from "../../utils/jwt";
import { JwtPayload, SignOptions } from "jsonwebtoken";
import { createError } from "../../utils/createError";
import { googleOAuth } from "../../utils/googleOAuth";
import { UserModel } from "../../../generated/prisma/models";
import { AuthTokenType, UserStatus } from "../../../generated/prisma/enums";
import { emailService } from "../email/email.service";
import { authTokens } from "./auth.tokens";

const issueTokens = (
  user: Pick<UserModel, "id" | "name" | "email" | "role">,
) => {
  const jwtPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  return {
    accessToken: jwtUtils.createToken(
      jwtPayload,
      config.jwt_access_secret,
      config.jwt_access_expires_in as SignOptions["expiresIn"],
    ),
    refreshToken: jwtUtils.createToken(
      jwtPayload,
      config.jwt_refresh_secret,
      config.jwt_refresh_expires_in as SignOptions["expiresIn"],
    ),
  };
};

export const EMAIL_NOT_VERIFIED =
  "Please verify your email address first. Check your inbox, or resend the link from your dashboard.";

/** Paying and publishing listings need a verified email. */
export const assertEmailVerified = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true },
  });
  if (!user?.emailVerifiedAt) {
    throw createError(403, EMAIL_NOT_VERIFIED);
  }
};

const assertNotSuspended = (user: Pick<UserModel, "status">) => {
  if (user.status === "SUSPENDED") {
    throw createError(
      403,
      "User account is suspended. Please contact support.",
    );
  }
};

const registerUser = async (payload: ICreateUserPayload) => {
  const { name, email, password, phone, role } = payload;
  const hashedPassword = await bcrypt.hash(
    password,
    Number(config.bcrypt_salt_rounds),
  );

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        phone,
        role,
      },
      select: safeUserSelect,
    });
    const token = await authTokens.issue(tx, created.id, AuthTokenType.VERIFY_EMAIL);
    await emailService.enqueue(tx, [
      {
        to: created.email,
        template: "verifyEmail",
        payload: { name: created.name, url: verifyUrl(token), welcome: true },
      },
    ]);
    return created;
  });
  emailService.dispatchSoon();
  return user;
};

const verifyUrl = (token: string) =>
  emailService.appUrl(`/verify-email?token=${encodeURIComponent(token)}`);
const resetUrl = (token: string) =>
  emailService.appUrl(`/reset-password?token=${encodeURIComponent(token)}`);

const loginUser = async (payload: ILoginPayload) => {
  const { email, password } = payload;
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (user && !user.passwordHash) {
    throw createError(
      400,
      "This account uses Google sign-in. Continue with Google instead.",
    );
  }

  const isPasswordMatched =
    user?.passwordHash && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !isPasswordMatched) {
    throw createError(400, "Email or password is incorrect!");
  }
  assertNotSuspended(user);

  return issueTokens(user);
};

const loginWithGoogle = async (payload: IGoogleLoginPayload) => {
  const { code, codeVerifier, redirectUri, role } = payload;

  const profile = await googleOAuth.getProfile(code, codeVerifier, redirectUri);

  let user =
    (await prisma.user.findUnique({ where: { googleId: profile.googleId } })) ??
    (await prisma.user.findUnique({ where: { email: profile.email } }));

  if (user) {
    assertNotSuspended(user);

    // Google only hands out verified addresses, so linking proves ownership.
    if (!user.googleId || !user.emailVerifiedAt) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: profile.googleId,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        },
      });
    }
  } else {
    user = await prisma.user.create({
      data: {
        name: profile.name,
        email: profile.email,
        googleId: profile.googleId,
        emailVerifiedAt: new Date(),
        passwordHash: null,
        role: role ?? "CUSTOMER",
      },
    });
  }

  return issueTokens(user);
};

const refreshToken = async (token: string) => {
  const verifiedToken = jwtUtils.verifyToken(token, config.jwt_refresh_secret);
  if (!verifiedToken.success) {
    throw createError(401, "Refresh token is invalid or expired");
  }

  const payload = verifiedToken.data as JwtPayload;
  const user = await prisma.user.findUnique({
    where: {
      id: payload.id,
    },
  });
  if (!user) {
    throw createError(404, "User not found");
  }
  if (jwtUtils.issuedBefore(payload, user.passwordChangedAt)) {
    throw createError(401, "Your password was changed. Please sign in again.");
  }
  assertNotSuspended(user);

  const { accessToken } = issueTokens(user);

  return {
    accessToken,
  };
};

const getLoggedInUser = async (userId: string) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      id: userId,
    },
    select: safeUserSelect,
  });
  return user;
};

const updateProfile = async (
  userId: string,
  payload: IUpdateProfilePayload,
) => {
  const { name, phone, marketingEmails } = payload;

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone: phone === "" ? null : phone }),
      ...(marketingEmails !== undefined && { marketingEmails }),
    },
    select: safeUserSelect,
  });

  return user;
};

// --------------------------------------------- verification & recovery

const verifyEmail = async (token: string) => {
  await prisma.$transaction(async (tx) => {
    const userId = await authTokens.consume(tx, token, AuthTokenType.VERIFY_EMAIL);
    await tx.user.updateMany({
      where: { id: userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
  });
};

const resendVerification = async (userId: string) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.emailVerifiedAt) {
    throw createError(400, "Your email is already verified");
  }

  await prisma.$transaction(async (tx) => {
    const token = await authTokens.issue(tx, user.id, AuthTokenType.VERIFY_EMAIL);
    await emailService.enqueue(tx, [
      {
        to: user.email,
        template: "verifyEmail",
        payload: { name: user.name, url: verifyUrl(token), welcome: false },
      },
    ]);
  });
  emailService.dispatchSoon();
};

/**
 * Always succeeds from the caller's point of view, so the endpoint can't be
 * used to find out which emails have accounts.
 */
const forgotPassword = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status === UserStatus.SUSPENDED) return;

  await prisma.$transaction(async (tx) => {
    const token = await authTokens.issue(tx, user.id, AuthTokenType.RESET_PASSWORD);
    await emailService.enqueue(tx, [
      {
        to: user.email,
        template: "resetPassword",
        payload: { name: user.name, url: resetUrl(token) },
      },
    ]);
  });
  emailService.dispatchSoon();
};

/**
 * Also works for Google-only accounts, which then gain a password. Receiving
 * the email proves the address, so it counts as verification too.
 */
const resetPassword = async (token: string, password: string) => {
  const passwordHash = await bcrypt.hash(
    password,
    Number(config.bcrypt_salt_rounds),
  );

  await prisma.$transaction(async (tx) => {
    const userId = await authTokens.consume(tx, token, AuthTokenType.RESET_PASSWORD);
    const now = new Date();
    const user = await tx.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: now },
    });
    if (!user.emailVerifiedAt) {
      await tx.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: now },
      });
    }
    await emailService.enqueue(tx, [
      { to: user.email, template: "passwordChanged", payload: { name: user.name } },
    ]);
  });
  emailService.dispatchSoon();
};

export const authService = {
  registerUser,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  loginUser,
  loginWithGoogle,
  refreshToken,
  getLoggedInUser,
  updateProfile,
};
